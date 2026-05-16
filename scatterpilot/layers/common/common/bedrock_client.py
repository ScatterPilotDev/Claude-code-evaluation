"""
Amazon Bedrock client wrapper for conversational AI
Handles Claude model interactions with structured data extraction
"""

import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

from .models import (
    BedrockRequest, BedrockResponse, Message, Conversation,
    InvoiceData, LineItem
)
from .logger import get_logger

logger = get_logger("bedrock_client")


class BedrockException(Exception):
    """Base exception for Bedrock operations"""
    pass


INVOICE_GENERATOR_TOOL_SPEC = {
    "toolSpec": {
        "name": "invoice_generator",
        "description": "Generates a structured invoice when all required information has been confirmed by the user. Only call this tool after the user has approved the invoice summary.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Legal name of the client"},
                    "customer_email": {"type": "string", "format": "email"},
                    "customer_address": {"type": "string"},
                    "invoice_date": {"type": "string", "format": "date", "description": "ISO 8601 date (YYYY-MM-DD)"},
                    "due_date": {"type": "string", "format": "date", "description": "ISO 8601 date (YYYY-MM-DD)"},
                    "line_items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "quantity": {"type": "number", "minimum": 0.01},
                                "unit_price": {"type": "number", "minimum": 0},
                                "taxable": {"type": "boolean", "default": True}
                            },
                            "required": ["description", "quantity", "unit_price"]
                        },
                        "minItems": 1
                    },
                    "tax_rate": {"type": "number", "description": "Decimal tax rate (e.g. 0.08 for 8%)"},
                    "discount": {"type": "number", "description": "Flat discount amount in currency units"},
                    "notes": {"type": "string"}
                },
                "required": ["customer_name", "due_date", "line_items"]
            }
        }
    }
}

CANCEL_INVOICE_TOOL_SPEC = {
    "toolSpec": {
        "name": "cancel_invoice",
        "description": "Cancels the current invoice creation process when the user explicitly requests to stop or cancel.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Optional reason for cancellation"}
                }
            }
        }
    }
}

INVOICE_TOOL_CONFIG = {
    "tools": [INVOICE_GENERATOR_TOOL_SPEC, CANCEL_INVOICE_TOOL_SPEC],
    "toolChoice": {"auto": {}}
}


class BedrockClient:
    """
    Amazon Bedrock client for Claude Sonnet 4.5 interactions
    Implements conversation management and structured data extraction
    """

    # Model configuration
    MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
    DEFAULT_MAX_TOKENS = 2048
    DEFAULT_TEMPERATURE = 0.7

    # System prompt for invoice extraction
    INVOICE_EXTRACTION_PROMPT = """You are the AI assistant for ScatterPilot, an integrated invoice generation system. Your role is to gather invoice information through natural conversation and trigger automatic invoice creation using the invoice_generator tool.

CRITICAL: You are part of an INTEGRATED SYSTEM. When you call the invoice_generator tool, the system automatically:
1. Creates the invoice in the database
2. Generates a professional PDF document
3. Displays the invoice to the user with a download button

YOUR WORKFLOW:
1. Start by asking: "Who are you invoicing and for what?" — gather as much as the user provides in one message
2. Parse everything from that first response: customer name, services, amounts, dates — whatever is there
3. Confirm all details in a single summary message, only asking for genuinely missing required fields
4. When user approves (says "looks good", "create it", "yes", etc.), call the invoice_generator tool with all confirmed details
5. The system takes over from there - you don't need to do anything else

EFFICIENCY RULES:
- Extract all information from a single user message whenever possible
- Do NOT ask one question at a time — if multiple fields are missing, ask for them all at once
- Do NOT repeat information back that the user already provided unless confirming the full summary
- Minimize back-and-forth: aim for 2-3 exchanges maximum before creating the invoice

REQUIRED INFORMATION:
1. Customer name (required)
2. Customer email (optional)
3. Customer address (optional)
4. Invoice date (defaults to today if not specified)
5. Due date (required)
6. Line items - each with:
   - Description
   - Quantity (must be positive)
   - Unit price (must be non-negative)
   - Taxable (boolean, defaults to true) - set to false if user specifies tax applies to specific items only
7. Tax rate (as decimal, defaults to 0.0)
8. Discount amount (optional, defaults to 0)
9. Additional notes (optional)

VALIDATION:
- Quantities must be positive numbers
- Prices must be non-negative
- Due date cannot be before invoice date

CRITICAL INSTRUCTIONS - NEVER DO THESE:
❌ DO NOT output raw JSON in your text response
❌ DO NOT explain what JSON or tool calls are to the user
❌ DO NOT say "I can't generate PDFs" - the system DOES generate them automatically
❌ DO NOT ask users to perform any manual steps

CORRECT BEHAVIOR:
✅ Be conversational and friendly while gathering information
✅ Confirm details with the user before calling any tool
✅ When user approves, call the invoice_generator tool — do not output JSON text
✅ Trust that the system will handle PDF generation automatically
✅ The user will see their invoice appear in the preview panel with a download button

IMPORTANT TAX HANDLING:
- If user says "tax applies to [specific item only]" or "6% on [item name] only", set taxable=false for all other items
- Example: "6% tax on POS only" means only the POS line item has taxable=true, others have taxable=false
- Default: All items are taxable=true unless user specifies otherwise
- tax_rate is a decimal: 0.08 means 8%

CUSTOMER AUTO-DETECTION (new vs returning clients):
When the user first mentions a customer/client name in a conversation:
1. Immediately confirm: "I see you're invoicing [Customer Name]. Is this a new client or have you worked with them before?"
2. If the user says returning/existing client:
   - Respond: "Got it — I'll use their details from before. Just tell me what to invoice them for."
   - Ask only for: line items, amounts, due date (skip re-asking for contact info)
   - If their contact info is provided later in conversation context, use it automatically
3. If the user says new client:
   - Gather all required contact information before proceeding: email, address
   - Then proceed to line items and amounts

MULTI-INVOICE CONVERSATIONS (creating additional invoices in the same conversation):
If a previous invoice_generator tool call appears in the conversation history, an invoice was already created. If the user asks for another invoice, a new invoice, or "same client different items":
✅ Automatically carry forward: customer_name, customer_email, customer_address, and tax_rate from the previous invoice
✅ Greet them with context, e.g. "I can see we already have [Customer Name] on file. I'll reuse their details — what should be on this new invoice?"
✅ Only ask for what has changed: new line items, new due date, any overrides the user mentions
✅ Do NOT re-ask for customer info already provided in this conversation
✅ When ready, call invoice_generator again with all fields populated (reusing the remembered ones)

To cancel the invoice creation process at any time, call the cancel_invoice tool.

REMEMBER: Use the invoice_generator tool when the user approves. The system automatically generates the PDF and shows it to the user. You are NOT generating PDFs yourself — the integrated system does that."""

    def __init__(self, region_name: str = "us-east-1"):
        """
        Initialize Bedrock client

        Args:
            region_name: AWS region for Bedrock service
        """
        self.bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=region_name
        )
        self.region_name = region_name

    def _get_current_date_context(self) -> str:
        """
        Generate current date/time context for system prompt

        Returns:
            Formatted date context string with current date and common date calculations
        """
        # Use UTC time (Lambda runs in UTC)
        # In the future, this could be enhanced to use user's timezone from profile
        now = datetime.utcnow()

        # Format current date
        current_date = now.strftime("%A, %B %d, %Y")
        current_date_iso = now.strftime("%Y-%m-%d")

        # Calculate common future dates
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        in_7_days = (now + timedelta(days=7)).strftime("%Y-%m-%d")
        in_14_days = (now + timedelta(days=14)).strftime("%Y-%m-%d")
        in_30_days = (now + timedelta(days=30)).strftime("%Y-%m-%d")
        in_60_days = (now + timedelta(days=60)).strftime("%Y-%m-%d")
        in_90_days = (now + timedelta(days=90)).strftime("%Y-%m-%d")

        # Calculate end of current month
        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1)
        else:
            next_month = now.replace(month=now.month + 1, day=1)
        end_of_month = (next_month - timedelta(days=1)).strftime("%Y-%m-%d")

        date_context = f"""
CRITICAL - CURRENT DATE AND TIME:
Today's date is: {current_date}
Today in ISO format: {current_date_iso}

IMPORTANT: When the user says "today", "dated today", or doesn't specify an invoice date, use {current_date_iso}.

DATE CALCULATION REFERENCE (calculate from {current_date_iso}):
- "tomorrow" = {tomorrow}
- "due in 7 days" / "due in a week" = {in_7_days}
- "due in 2 weeks" / "due in 14 days" = {in_14_days}
- "due in 30 days" / "due in a month" = {in_30_days}
- "due in 60 days" / "due in 2 months" = {in_60_days}
- "due in 90 days" / "due in 3 months" = {in_90_days}
- "due end of month" = {end_of_month}

CRITICAL DATE RULES:
1. ALWAYS use {current_date_iso} as "today" - NEVER use dates from your training data
2. ALWAYS calculate future dates relative to {current_date_iso}
3. When user says "due in X days", add X days to {current_date_iso}
4. If user specifies a past date for invoice_date, accept it (they may be creating a backdated invoice)
5. Due date must ALWAYS be after invoice date
6. If user specifies just a month/day (e.g., "December 25"), assume the current year {now.year}

Example conversations:
User: "Invoice for today, due in 30 days"
You should use: invoice_date = {current_date_iso}, due_date = {in_30_days}

User: "Invoice dated November 20, due in 2 weeks"
You should use: invoice_date = {now.year}-11-20, due_date = {(now.replace(month=11, day=20) + timedelta(days=14)).strftime("%Y-%m-%d")}
"""

        return date_context

    def converse(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
        tool_config: Optional[Dict[str, Any]] = None,
    ) -> BedrockResponse:
        """
        Send a conversation to Claude via Bedrock Converse API

        Args:
            messages: List of conversation messages
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0-1)
            tool_config: Optional Bedrock toolConfig for native tool use

        Returns:
            BedrockResponse with model output

        Raises:
            BedrockException: If API call fails
        """
        start_time = time.time()

        try:
            # Build request
            request = BedrockRequest(
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                tool_config=tool_config,
            )

            api_params = request.to_api_params()
            api_params['modelId'] = self.MODEL_ID

            logger.debug(
                "Sending request to Bedrock",
                model_id=self.MODEL_ID,
                message_count=len(messages)
            )

            # Call Bedrock API
            response = self.bedrock_runtime.converse(**api_params)

            # Parse response
            bedrock_response = BedrockResponse.from_api_response(response)

            # Log usage metrics
            duration_ms = (time.time() - start_time) * 1000
            logger.log_api_call(
                service="bedrock",
                operation="converse",
                status="success",
                duration_ms=duration_ms,
                input_tokens=bedrock_response.usage.get('inputTokens', 0),
                output_tokens=bedrock_response.usage.get('outputTokens', 0)
            )

            return bedrock_response

        except ClientError as e:
            duration_ms = (time.time() - start_time) * 1000
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')

            logger.log_api_call(
                service="bedrock",
                operation="converse",
                status="error",
                duration_ms=duration_ms,
                error_code=error_code
            )

            logger.error("Bedrock API call failed", error=e)
            raise BedrockException(f"Bedrock API error: {str(e)}")

        except Exception as e:
            logger.error("Unexpected error in Bedrock call", error=e)
            raise BedrockException(f"Unexpected error: {str(e)}")

    def process_conversation_turn(
        self,
        conversation: Conversation,
        user_message: str,
        typical_services: Optional[str] = None,
        default_rate: Optional[str] = None,
        rate_type: Optional[str] = None,
    ) -> tuple[str, Optional[Dict[str, Any]]]:
        """
        Process a single turn of conversation with invoice extraction

        Args:
            conversation: Current conversation state
            user_message: New message from user
            typical_services: Optional description of typical services the user offers
            default_rate: User's default billing rate (numeric string)
            rate_type: Rate period — "hour", "project", or "day"

        Returns:
            Tuple of (assistant_response, extracted_data_if_complete)

        Raises:
            BedrockException: If processing fails
        """
        # Add user message to conversation
        conversation.add_message(role="user", content=user_message)

        try:
            # Build system prompt with current date context
            date_context = self._get_current_date_context()
            enhanced_system_prompt = date_context + "\n\n" + self.INVOICE_EXTRACTION_PROMPT

            # Inject typical_services context if available
            if typical_services and typical_services.strip():
                enhanced_system_prompt += f"\n\nUSER'S TYPICAL SERVICES:\nThis user typically invoices for: {typical_services.strip()}\nWhen the user mentions a service that matches or resembles one of these, use the familiar terminology and suggest typical pricing if not specified."

            # Inject default rate context if available
            if default_rate and str(default_rate).strip():
                rate_label = {'hour': 'per hour', 'project': 'per project', 'day': 'per day'}.get(rate_type or 'hour', 'per hour')
                enhanced_system_prompt += f"\n\nUSER'S DEFAULT RATE:\nThis user's typical billing rate is ${default_rate} {rate_label}. If the user doesn't specify an amount or rate for a line item, use this as the default and confirm it with them."

            logger.debug("Using enhanced system prompt with current date context")

            # Get response from Claude with native tool use
            response = self.converse(
                messages=conversation.messages,
                system_prompt=enhanced_system_prompt,
                temperature=0.7,
                tool_config=INVOICE_TOOL_CONFIG,
            )

            assistant_message = response.content
            extracted_data = None

            # Handle tool_use stop reason — model called a tool instead of generating text
            if response.stop_reason == "tool_use" and response.tool_use_input is not None:
                if response.tool_name == "invoice_generator":
                    extracted_data = {
                        "action": "create_invoice",
                        "data": response.tool_use_input,
                    }
                    logger.info(
                        "Tool call: invoice_generator",
                        tool_use_id=response.tool_use_id
                    )
                elif response.tool_name == "cancel_invoice":
                    extracted_data = {"action": "cancel"}
                    logger.info(
                        "Tool call: cancel_invoice",
                        tool_use_id=response.tool_use_id
                    )

            # Ensure a non-empty text message for the conversation history and API response
            if not assistant_message and extracted_data:
                action = extracted_data.get("action")
                if action == "create_invoice":
                    assistant_message = "Your invoice is ready!"
                elif action == "cancel":
                    assistant_message = "Invoice creation cancelled."

            # Add assistant message to conversation
            conversation.add_message(role="assistant", content=assistant_message)

            # Log usage for cost tracking
            logger.log_bedrock_usage(
                input_tokens=response.usage.get('inputTokens', 0),
                output_tokens=response.usage.get('outputTokens', 0),
                conversation_id=conversation.conversation_id
            )

            return assistant_message, extracted_data

        except Exception as e:
            logger.error(
                "Failed to process conversation turn",
                error=e,
                conversation_id=conversation.conversation_id
            )
            raise

    def validate_and_parse_invoice_data(self, data: Dict[str, Any]) -> InvoiceData:
        """
        Validate and parse extracted invoice data into InvoiceData model

        Args:
            data: Raw data extracted from conversation

        Returns:
            Validated InvoiceData object

        Raises:
            ValueError: If data is invalid
        """
        try:
            # Extract the data portion
            invoice_dict = data.get('data', {})

            # Parse line items
            from decimal import Decimal
            from datetime import date

            line_items = []
            for item in invoice_dict.get('line_items', []):
                line_items.append(LineItem(
                    description=item['description'],
                    quantity=Decimal(str(item['quantity'])),
                    unit_price=Decimal(str(item['unit_price'])),
                    taxable=bool(item.get('taxable', True)),
                ))

            # Parse dates
            invoice_date = date.fromisoformat(invoice_dict['invoice_date'])
            due_date = date.fromisoformat(invoice_dict['due_date'])
            today = date.today()

            # Date validation with auto-correction
            # Allow backdated invoices up to 90 days in the past (legitimate business need)
            if invoice_date < today - timedelta(days=90):
                logger.warning(
                    "Invoice date is more than 90 days in past, auto-correcting to today",
                    original_date=str(invoice_date),
                    corrected_date=str(today)
                )
                invoice_date = today

            # Ensure due date is after invoice date
            if due_date < invoice_date:
                logger.warning(
                    "Due date is before invoice date, auto-correcting to 30 days from invoice",
                    invoice_date=str(invoice_date),
                    original_due_date=str(due_date),
                    corrected_due_date=str(invoice_date + timedelta(days=30))
                )
                due_date = invoice_date + timedelta(days=30)

            # Warn if due date is unreasonably far in future (> 1 year)
            if due_date > today + timedelta(days=365):
                logger.warning(
                    "Due date is more than 1 year in future",
                    due_date=str(due_date)
                )
                # Don't auto-correct this, might be intentional

            # Build invoice data
            invoice_data = InvoiceData(
                customer_name=invoice_dict['customer_name'],
                customer_email=invoice_dict.get('customer_email'),
                customer_address=invoice_dict.get('customer_address'),
                invoice_date=invoice_date,
                due_date=due_date,
                line_items=line_items,
                tax_rate=Decimal(str(invoice_dict.get('tax_rate', '0.00'))),
                discount=Decimal(str(invoice_dict.get('discount', '0.00'))),
                notes=invoice_dict.get('notes')
            )

            logger.info(
                "Invoice data validated",
                customer=invoice_data.customer_name,
                invoice_date=str(invoice_date),
                due_date=str(due_date),
                line_items_count=len(invoice_data.line_items),
                total=str(invoice_data.total)
            )

            return invoice_data

        except KeyError as e:
            logger.error("Missing required field in invoice data", error=e)
            raise ValueError(f"Missing required field: {str(e)}")
        except ValueError as e:
            logger.error("Invalid data format in invoice data", error=e)
            raise ValueError(f"Invalid data format: {str(e)}")
        except Exception as e:
            logger.error("Failed to parse invoice data", error=e)
            raise ValueError(f"Failed to parse invoice data: {str(e)}")

    def generate_invoice_summary(self, invoice_data: InvoiceData) -> str:
        """
        Generate a human-readable summary of invoice data

        Args:
            invoice_data: Validated invoice data

        Returns:
            Formatted summary string
        """
        summary_parts = [
            f"Invoice for {invoice_data.customer_name}",
            f"Date: {invoice_data.invoice_date}",
            f"Due: {invoice_data.due_date}",
            "",
            "Line Items:"
        ]

        for i, item in enumerate(invoice_data.line_items, 1):
            summary_parts.append(
                f"  {i}. {item.description} - "
                f"{item.quantity} x ${item.unit_price} = ${item.total}"
            )

        summary_parts.extend([
            "",
            f"Subtotal: ${invoice_data.subtotal}",
            f"Discount: ${invoice_data.discount}",
            f"Tax ({invoice_data.tax_rate * 100}%): ${invoice_data.tax_amount}",
            f"Total: ${invoice_data.total}"
        ])

        if invoice_data.notes:
            summary_parts.extend(["", f"Notes: {invoice_data.notes}"])

        return "\n".join(summary_parts)
