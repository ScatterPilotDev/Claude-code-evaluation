"""
Amazon Bedrock client wrapper for conversational AI
Handles Claude model interactions with structured data extraction
"""

import json
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


class BedrockClient:
    """
    Amazon Bedrock client for Claude Sonnet 4.5 interactions
    Implements conversation management and structured data extraction
    """

    # Model configuration
    MODEL_ID = "anthropic.claude-sonnet-4-5-20250929-v1:0"
    DEFAULT_MAX_TOKENS = 2048
    DEFAULT_TEMPERATURE = 0.7

    # System prompt for invoice extraction
    INVOICE_EXTRACTION_PROMPT = """You are the AI assistant for ScatterPilot, an integrated invoice generation system. Your role is to gather invoice information through natural conversation and trigger automatic invoice creation.

CRITICAL: You are part of an INTEGRATED SYSTEM that automatically generates PDF invoices. When you output JSON, the system:
1. Automatically creates the invoice in the database
2. Generates a professional PDF document
3. Displays the invoice to the user with a download button
4. Handles all file generation and storage

YOUR WORKFLOW:
1. Gather invoice information through natural, friendly conversation
2. Ask for any missing required information
3. Confirm all details with the user
4. When user approves (says "looks good", "create it", "yes", etc.), output ONLY the JSON object
5. The system takes over from there - you don't need to do anything else

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
7. Tax rate (as percentage, defaults to 0%)
8. Discount amount (optional, defaults to 0)
9. Additional notes (optional)

VALIDATION:
- Quantities must be positive numbers
- Prices must be non-negative
- Due date cannot be before invoice date

CRITICAL INSTRUCTIONS - NEVER DO THESE:
❌ DO NOT show JSON to users
❌ DO NOT explain what JSON is or how it works
❌ DO NOT say "I can't generate PDFs" - the system DOES generate them automatically
❌ DO NOT ask users to "copy this JSON" or use external tools
❌ DO NOT include markdown code blocks around JSON
❌ DO NOT add explanatory text before or after the JSON

CORRECT BEHAVIOR:
✅ Be conversational and friendly while gathering information
✅ Confirm details with the user before finalizing
✅ When user approves, output ONLY the raw JSON object (no markdown, no explanation)
✅ Trust that the system will handle PDF generation automatically
✅ The user will see their invoice appear in the preview panel with a download button

JSON FORMAT (output this EXACTLY when ready):
{
  "action": "create_invoice",
  "data": {
    "customer_name": "string",
    "customer_email": "string (optional)",
    "customer_address": "string (optional)",
    "invoice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "line_items": [
      {
        "description": "string",
        "quantity": "decimal",
        "unit_price": "decimal",
        "taxable": true
      }
    ],
    "tax_rate": "decimal (0.08 for 8%)",
    "discount": "decimal",
    "notes": "string (optional)"
  }
}

IMPORTANT TAX HANDLING:
- If user says "tax applies to [specific item only]" or "6% on [item name] only", set taxable=false for all other items
- Example: "6% tax on POS only" means only the POS line item has taxable=true, others have taxable=false
- Default: All items are taxable=true unless user specifies otherwise

To cancel:
{
  "action": "cancel"
}

REMEMBER: Output ONLY the raw JSON when the user approves. The system automatically generates the PDF and shows it to the user. You are NOT generating PDFs yourself - the integrated system does that."""

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
        temperature: float = DEFAULT_TEMPERATURE
    ) -> BedrockResponse:
        """
        Send a conversation to Claude via Bedrock Converse API

        Args:
            messages: List of conversation messages
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0-1)

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
                temperature=temperature
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
        user_message: str
    ) -> tuple[str, Optional[Dict[str, Any]]]:
        """
        Process a single turn of conversation with invoice extraction

        Args:
            conversation: Current conversation state
            user_message: New message from user

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

            logger.debug("Using enhanced system prompt with current date context")

            # Get response from Claude
            response = self.converse(
                messages=conversation.messages,
                system_prompt=enhanced_system_prompt,
                temperature=0.7  # Balance creativity and consistency
            )

            assistant_message = response.content

            # Check if response contains structured data (JSON)
            extracted_data = self._extract_json_from_response(assistant_message)

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

    def _extract_json_from_response(self, response: str) -> Optional[Dict[str, Any]]:
        """
        Extract JSON data from model response if present

        Args:
            response: Model response text

        Returns:
            Parsed JSON object or None if not found
        """
        # Look for JSON object in response
        try:
            # Try to find JSON block (might be wrapped in markdown code blocks)
            json_str = response.strip()

            # Remove markdown code blocks if present
            if json_str.startswith('```json'):
                json_str = json_str[7:]  # Remove ```json
            if json_str.startswith('```'):
                json_str = json_str[3:]  # Remove ```
            if json_str.endswith('```'):
                json_str = json_str[:-3]  # Remove trailing ```

            json_str = json_str.strip()

            # Try to parse JSON
            if json_str.startswith('{'):
                data = json.loads(json_str)

                # Validate it has the expected structure
                if isinstance(data, dict) and 'action' in data:
                    logger.info(
                        "Extracted structured data from response",
                        action=data.get('action')
                    )
                    return data

        except json.JSONDecodeError:
            # Not JSON, that's okay - conversational response
            pass
        except Exception as e:
            logger.warning("Error extracting JSON from response", error=e)

        return None

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
                    unit_price=Decimal(str(item['unit_price']))
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
