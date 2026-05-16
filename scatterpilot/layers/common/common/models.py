"""
Pydantic models for data validation and serialization
Ensures type safety and automatic validation across the application
Unified for Single Table Design (PK: USER#id, SK: ENTITY#id)
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any, Type, TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, ConfigDict, model_validator


class InvoiceStatus(str, Enum):
    """Invoice lifecycle states"""
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    PENDING = "pending"
    CANCELLED = "cancelled"


class ConversationState(str, Enum):
    """Conversation flow states"""
    INITIATED = "initiated"
    GATHERING_INFO = "gathering_info"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ScatterPilotItem(BaseModel):
    """Base class for all items in the single DynamoDB table"""
    pk: str = Field(..., alias="PK", description="Partition Key: USER#id")
    sk: str = Field(..., alias="SK", description="Sort Key: ENTITY#id")
    entity_type: str = Field(..., alias="EntityType", description="Type of entity")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )

    @classmethod
    def make_pk(cls, user_id: str) -> str:
        return f"USER#{user_id}"

    @classmethod
    def make_sk(cls, entity_type: str, entity_id: str) -> str:
        return f"{entity_type.upper()}#{entity_id}"

    def to_dynamodb(self) -> Dict[str, Any]:
        """Convert to DynamoDB-compatible dictionary"""
        data = self.model_dump(by_alias=True)
        # Handle datetime and decimal serialization
        return self._serialize_dict(data)

    def _serialize_dict(self, d: Any) -> Any:
        if isinstance(d, dict):
            return {k: self._serialize_dict(v) for k, v in d.items()}
        elif isinstance(d, list):
            return [self._serialize_dict(v) for v in d]
        elif isinstance(d, datetime):
            return d.isoformat()
        elif isinstance(d, date):
            return d.isoformat()
        elif isinstance(d, Decimal):
            return str(d)
        elif isinstance(d, Enum):
            return d.value
        return d


class LineItem(BaseModel):
    """Individual line item in an invoice"""
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    taxable: bool = Field(default=True)

    @property
    def total(self) -> Decimal:
        return self.quantity * self.unit_price


class InvoiceData(BaseModel):
    """Complete invoice information extracted from conversation"""
    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_email: Optional[str] = Field(None, max_length=254)
    customer_address: Optional[str] = Field(None, max_length=500)
    invoice_date: date = Field(default_factory=lambda: datetime.now().date())
    due_date: date
    invoice_number: Optional[str] = Field(None, max_length=50)
    line_items: List[LineItem] = Field(..., min_length=1)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=1)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @property
    def subtotal(self) -> Decimal:
        return sum(item.total for item in self.line_items)

    @property
    def taxable_subtotal(self) -> Decimal:
        return sum(item.total for item in self.line_items if item.taxable)

    @property
    def tax_amount(self) -> Decimal:
        return self.taxable_subtotal * self.tax_rate

    @property
    def total(self) -> Decimal:
        return self.subtotal - self.discount + self.tax_amount

    def to_dynamodb(self) -> Dict[str, Any]:
        """Serialize to DynamoDB-compatible dict including computed fields."""
        def _s(v: Any) -> Any:
            if isinstance(v, Decimal):
                return str(v)
            if isinstance(v, (datetime, date)):
                return v.isoformat()
            return v

        return {
            'customer_name': self.customer_name,
            'customer_email': self.customer_email,
            'customer_address': self.customer_address,
            'invoice_date': _s(self.invoice_date),
            'due_date': _s(self.due_date),
            'invoice_number': self.invoice_number,
            'line_items': [
                {
                    'description': item.description,
                    'quantity': _s(item.quantity),
                    'unit_price': _s(item.unit_price),
                    'total': _s(item.total),
                    'taxable': item.taxable,
                }
                for item in self.line_items
            ],
            'subtotal': _s(self.subtotal),
            'tax_rate': _s(self.tax_rate),
            'discount': _s(self.discount),
            'tax_amount': _s(self.tax_amount),
            'total': _s(self.total),
            'notes': self.notes,
        }


class Message(ScatterPilotItem):
    """Individual conversation message as a standalone item"""
    message_id: str = Field(default_factory=lambda: str(uuid4()))
    conversation_id: str
    user_id: str
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode='before')
    @classmethod
    def set_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            user_id = data.get('user_id')
            conv_id = data.get('conversation_id')
            msg_id = data.get('message_id') or str(uuid4())
            data['message_id'] = msg_id
            data['PK'] = cls.make_pk(user_id)
            # Messages are sorted by conversation and then timestamp for efficient retrieval
            ts = data.get('timestamp') or datetime.utcnow()
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            data['SK'] = f"CONVERSATION#{conv_id}#MESSAGE#{ts.isoformat()}"
            data['EntityType'] = 'message'
        return data

    def to_bedrock_format(self) -> Dict[str, Any]:
        return {"role": self.role, "content": [{"text": self.content}]}


class Conversation(ScatterPilotItem):
    """Multi-turn conversation session"""
    conversation_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    state: ConversationState = Field(default=ConversationState.INITIATED)
    messages: List[Message] = Field(default_factory=list)
    extracted_data: Optional[Dict[str, Any]] = None

    @model_validator(mode='before')
    @classmethod
    def set_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            user_id = data.get('user_id')
            conv_id = data.get('conversation_id') or str(uuid4())
            data['conversation_id'] = conv_id
            data['PK'] = cls.make_pk(user_id)
            data['SK'] = cls.make_sk('CONVERSATION', conv_id)
            data['EntityType'] = 'conversation'
        return data

    def add_message(self, role: str, content: str) -> None:
        self.messages.append(Message(
            user_id=self.user_id,
            conversation_id=self.conversation_id,
            role=role,
            content=content,
        ))
        self.updated_at = datetime.utcnow()

    def to_bedrock_messages(self) -> List[Dict[str, Any]]:
        return [msg.to_bedrock_format() for msg in self.messages]

    def to_dynamodb(self) -> Dict[str, Any]:
        item = super().to_dynamodb()
        item['messages'] = [
            {'role': msg.role, 'content': msg.content, 'timestamp': msg.timestamp.isoformat()}
            for msg in self.messages
        ]
        return item


class Invoice(ScatterPilotItem):
    """Invoice record in database"""
    invoice_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    conversation_id: Optional[str] = None
    data: InvoiceData
    status: InvoiceStatus = Field(default=InvoiceStatus.DRAFT)
    pdf_s3_key: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def set_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            user_id = data.get('user_id')
            inv_id = data.get('invoice_id') or str(uuid4())
            data['invoice_id'] = inv_id
            data['PK'] = cls.make_pk(user_id)
            data['SK'] = cls.make_sk('INVOICE', inv_id)
            data['EntityType'] = 'invoice'
        return data

    def to_dynamodb(self) -> Dict[str, Any]:
        item = super().to_dynamodb()
        item['data'] = self.data.to_dynamodb()
        return item


class Profile(ScatterPilotItem):
    """User business profile and billing record"""
    user_id: str
    email: Optional[str] = None
    business_name: Optional[str] = None
    contact_name: Optional[str] = None
    stripe_customer_id: Optional[str] = Field(None, alias="StripeCustomerId")
    subscription_status: str = Field(default="free")

    # GSI1 fields for mapping StripeCustomerId to UserId
    gsi1pk: Optional[str] = Field(None, alias="GSI1PK")
    gsi1sk: Optional[str] = Field(None, alias="GSI1SK")

    @model_validator(mode='before')
    @classmethod
    def set_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            user_id = data.get('user_id')
            data['PK'] = cls.make_pk(user_id)
            data['SK'] = cls.make_sk('PROFILE', user_id)
            data['EntityType'] = 'profile'

            # Map Stripe Customer ID to GSI1 for reverse lookups
            stripe_id = data.get('stripe_customer_id') or data.get('StripeCustomerId')
            if stripe_id:
                data['GSI1PK'] = f"STRIPE_CUSTOMER#{stripe_id}"
                data['GSI1SK'] = f"USER#{user_id}"
        return data


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
    tool_config: Optional[Dict[str, Any]] = None

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
        if self.tool_config:
            params["toolConfig"] = self.tool_config
        return params


class BedrockResponse(BaseModel):
    """Response from Bedrock API"""
    content: str
    stop_reason: str
    usage: Dict[str, int]
    tool_use_input: Optional[Dict[str, Any]] = None
    tool_use_id: Optional[str] = None
    tool_name: Optional[str] = None

    @classmethod
    def from_api_response(cls, response: Dict[str, Any]) -> "BedrockResponse":
        """Parse Bedrock API response, handling both text and tool_use content blocks"""
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])

        content = ""
        tool_use_input = None
        tool_use_id = None
        tool_name = None

        for block in content_blocks:
            if "text" in block:
                content += block["text"]
            elif "toolUse" in block:
                tool_use = block["toolUse"]
                tool_use_input = tool_use.get("input")
                tool_use_id = tool_use.get("toolUseId")
                tool_name = tool_use.get("name")

        return cls(
            content=content,
            stop_reason=response.get("stopReason", "unknown"),
            usage=response.get("usage", {}),
            tool_use_input=tool_use_input,
            tool_use_id=tool_use_id,
            tool_name=tool_name,
        )
