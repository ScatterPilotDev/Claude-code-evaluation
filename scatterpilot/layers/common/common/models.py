"""
Pydantic models for data validation and serialization
Ensures type safety and automatic validation across the application
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, ConfigDict


class InvoiceStatus(str, Enum):
    """Invoice lifecycle states"""
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"


class ConversationState(str, Enum):
    """Conversation flow states"""
    INITIATED = "initiated"
    GATHERING_INFO = "gathering_info"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class LineItem(BaseModel):
    """Individual line item in an invoice"""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    description: str = Field(..., min_length=1, max_length=500, description="Item description")
    quantity: Decimal = Field(..., gt=0, description="Quantity ordered")
    unit_price: Decimal = Field(..., ge=0, description="Price per unit")
    taxable: bool = Field(default=True, description="Whether this item is subject to tax")

    @property
    def total(self) -> Decimal:
        """Calculate line item total"""
        return self.quantity * self.unit_price

    @field_validator('description')
    @classmethod
    def sanitize_description(cls, v: str) -> str:
        """Remove potentially dangerous characters"""
        return v.strip()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to DynamoDB-compatible dict"""
        return {
            "description": self.description,
            "quantity": str(self.quantity),  # DynamoDB doesn't support Decimal in JSON
            "unit_price": str(self.unit_price),
            "total": str(self.total),
            "taxable": self.taxable
        }


class InvoiceData(BaseModel):
    """Complete invoice information extracted from conversation"""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_email: Optional[str] = Field(None, max_length=254)
    customer_address: Optional[str] = Field(None, max_length=500)

    invoice_date: date = Field(default_factory=lambda: datetime.now().date())
    due_date: date
    invoice_number: Optional[str] = Field(None, max_length=50)

    line_items: List[LineItem] = Field(..., min_length=1)

    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=1, description="Tax rate as decimal (0.08 = 8%)")
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @property
    def subtotal(self) -> Decimal:
        """Calculate subtotal before tax"""
        return sum(item.total for item in self.line_items)

    @property
    def taxable_subtotal(self) -> Decimal:
        """Calculate subtotal of only taxable items"""
        return sum(item.total for item in self.line_items if item.taxable)

    @property
    def tax_amount(self) -> Decimal:
        """Calculate tax amount on taxable items only"""
        # Apply tax only to taxable items, after discount is proportionally applied
        if self.subtotal == 0:
            return Decimal("0.00")

        # Calculate discount proportion for taxable items
        taxable_ratio = self.taxable_subtotal / self.subtotal if self.subtotal > 0 else Decimal("0.00")
        taxable_discount = self.discount * taxable_ratio

        # Tax = (taxable_subtotal - proportional_discount) * tax_rate
        return (self.taxable_subtotal - taxable_discount) * self.tax_rate

    @property
    def total(self) -> Decimal:
        """Calculate final total"""
        return self.subtotal - self.discount + self.tax_amount

    @field_validator('due_date')
    @classmethod
    def validate_due_date(cls, v: date, info) -> date:
        """Ensure due date is not in the past"""
        invoice_date = info.data.get('invoice_date', datetime.now().date())
        if v < invoice_date:
            raise ValueError("Due date cannot be before invoice date")
        return v

    def to_dynamodb(self) -> Dict[str, Any]:
        """Convert to DynamoDB-compatible format"""
        return {
            "customer_name": self.customer_name,
            "customer_email": self.customer_email,
            "customer_address": self.customer_address,
            "invoice_date": self.invoice_date.isoformat(),
            "due_date": self.due_date.isoformat(),
            "invoice_number": self.invoice_number,
            "line_items": [item.to_dict() for item in self.line_items],
            "tax_rate": str(self.tax_rate),
            "discount": str(self.discount),
            "notes": self.notes,
            "subtotal": str(self.subtotal),
            "tax_amount": str(self.tax_amount),
            "total": str(self.total)
        }


class Message(BaseModel):
    """Conversation message"""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=10000)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    def to_bedrock_format(self) -> Dict[str, Any]:
        """Convert to Bedrock API format"""
        return {
            "role": self.role,
            "content": [{"text": self.content}]
        }

    def to_dynamodb(self) -> Dict[str, Any]:
        """Convert to DynamoDB format"""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat()
        }


class Conversation(BaseModel):
    """Multi-turn conversation session"""
    conversation_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str = Field(..., min_length=1, max_length=256)
    state: ConversationState = Field(default=ConversationState.INITIATED)
    messages: List[Message] = Field(default_factory=list)
    extracted_data: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def add_message(self, role: str, content: str) -> None:
        """Add a message to the conversation"""
        self.messages.append(Message(role=role, content=content))
        self.updated_at = datetime.utcnow()

    def to_bedrock_messages(self) -> List[Dict[str, Any]]:
        """Convert messages to Bedrock API format"""
        return [msg.to_bedrock_format() for msg in self.messages]

    def to_dynamodb(self) -> Dict[str, Any]:
        """Convert to DynamoDB format"""
        return {
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "state": self.state.value,
            "messages": [msg.to_dynamodb() for msg in self.messages],
            "extracted_data": self.extracted_data,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class Invoice(BaseModel):
    """Invoice record in database"""
    invoice_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str = Field(..., min_length=1, max_length=256)
    conversation_id: Optional[str] = None
    data: InvoiceData
    status: InvoiceStatus = Field(default=InvoiceStatus.DRAFT)
    pdf_s3_key: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_dynamodb(self) -> Dict[str, Any]:
        """Convert to DynamoDB format"""
        return {
            "invoice_id": self.invoice_id,
            "user_id": self.user_id,
            "conversation_id": self.conversation_id,
            "data": self.data.to_dynamodb(),
            "status": self.status.value,
            "pdf_s3_key": self.pdf_s3_key,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class RateLimit(BaseModel):
    """Rate limiting record"""
    user_id: str = Field(..., min_length=1, max_length=256)
    request_count: int = Field(default=0, ge=0)
    window_start: datetime = Field(default_factory=datetime.utcnow)
    ttl: int = Field(..., description="Unix timestamp for DynamoDB TTL")

    @classmethod
    def create_new(cls, user_id: str, window_seconds: int = 3600) -> "RateLimit":
        """Create a new rate limit window"""
        now = datetime.utcnow()
        return cls(
            user_id=user_id,
            request_count=1,
            window_start=now,
            ttl=int(now.timestamp()) + window_seconds
        )

    def increment(self) -> None:
        """Increment request count"""
        self.request_count += 1

    def is_expired(self, window_seconds: int = 3600) -> bool:
        """Check if rate limit window has expired"""
        elapsed = (datetime.utcnow() - self.window_start).total_seconds()
        return elapsed >= window_seconds

    def to_dynamodb(self) -> Dict[str, Any]:
        """Convert to DynamoDB format"""
        return {
            "user_id": self.user_id,
            "request_count": self.request_count,
            "window_start": self.window_start.isoformat(),
            "ttl": self.ttl
        }


class BedrockRequest(BaseModel):
    """Request to Bedrock Converse API"""
    messages: List[Message]
    system_prompt: Optional[str] = None
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0, le=1)

    def to_api_params(self) -> Dict[str, Any]:
        """Convert to Bedrock API parameters"""
        params: Dict[str, Any] = {
            "messages": [msg.to_bedrock_format() for msg in self.messages],
            "inferenceConfig": {
                "maxTokens": self.max_tokens,
                "temperature": self.temperature
            }
        }
        if self.system_prompt:
            params["system"] = [{"text": self.system_prompt}]
        return params


class BedrockResponse(BaseModel):
    """Response from Bedrock API"""
    content: str
    stop_reason: str
    usage: Dict[str, int]

    @classmethod
    def from_api_response(cls, response: Dict[str, Any]) -> "BedrockResponse":
        """Parse Bedrock API response"""
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])

        # Extract text from content blocks
        content = ""
        for block in content_blocks:
            if "text" in block:
                content += block["text"]

        return cls(
            content=content,
            stop_reason=response.get("stopReason", "unknown"),
            usage=response.get("usage", {})
        )
