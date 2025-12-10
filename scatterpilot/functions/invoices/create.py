"""
Lambda function: Create Invoice
Creates an invoice from conversation data or direct input
"""

import json
import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.bedrock_client import BedrockClient
from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import Invoice, InvoiceData, InvoiceStatus, LineItem
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("create_invoice")

# Free tier limit
FREE_TIER_INVOICE_LIMIT = 5


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for creating invoices

    Event structure:
    {
        "conversation_id": "optional-conversation-id-to-use-extracted-data",
        "invoice_data": {
            "customer_name": "...",
            "invoice_date": "2024-01-15",
            "due_date": "2024-02-15",
            "line_items": [...],
            "tax_rate": "0.08",
            ...
        }
    }

    Returns:
        API Gateway response with created invoice
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Parse request body
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)

        db_helper = DynamoDBHelper()

        # Check subscription and usage limits
        subscription = db_helper.check_and_reset_monthly_count(user_id)
        is_pro = subscription.get('subscription_status') == 'pro'
        invoices_this_month = subscription.get('invoices_this_month', 0)

        if not is_pro and invoices_this_month >= FREE_TIER_INVOICE_LIMIT:
            logger.info(
                "Free tier limit reached",
                user_id=user_id,
                invoices_this_month=invoices_this_month
            )
            return create_error_response(
                403,
                f"Free tier limit reached. You've created {invoices_this_month}/{FREE_TIER_INVOICE_LIMIT} invoices this month. Upgrade to Pro for unlimited invoices.",
                "UsageLimitExceeded"
            )

        invoice_data_dict = None
        conversation_id = body.get('conversation_id')

        # Option 1: Create from conversation
        if conversation_id:
            logger.info("Creating invoice from conversation", conversation_id=conversation_id)

            conversation = db_helper.get_conversation(conversation_id)
            if not conversation:
                return create_error_response(404, "Conversation not found", "NotFound")

            # Verify ownership
            if conversation.user_id != user_id:
                return create_error_response(403, "Not authorized", "Forbidden")

            # Get extracted data
            if not conversation.extracted_data:
                return create_error_response(
                    400,
                    "Conversation has no extracted invoice data",
                    "ValidationError"
                )

            invoice_data_dict = conversation.extracted_data

        # Option 2: Create from direct data
        elif 'invoice_data' in body:
            logger.info("Creating invoice from direct data")
            invoice_data_dict = {
                'action': 'create_invoice',
                'data': body['invoice_data']
            }

        else:
            return create_error_response(
                400,
                "Either conversation_id or invoice_data is required",
                "ValidationError"
            )

        # Parse and validate invoice data
        try:
            bedrock_client = BedrockClient()
            invoice_data = bedrock_client.validate_and_parse_invoice_data(invoice_data_dict)

        except ValueError as e:
            logger.warning("Invalid invoice data", error=str(e))
            return create_error_response(400, f"Invalid invoice data: {str(e)}", "ValidationError")

        # Create invoice record
        invoice = Invoice(
            user_id=user_id,
            conversation_id=conversation_id,
            data=invoice_data,
            status=InvoiceStatus.DRAFT
        )

        db_helper.create_invoice(invoice)

        # Increment monthly invoice count
        new_count = db_helper.increment_monthly_invoice_count(user_id)

        logger.info(
            "Invoice created successfully",
            invoice_id=invoice.invoice_id,
            customer=invoice_data.customer_name,
            total=str(invoice_data.total),
            monthly_count=new_count
        )

        # Generate summary
        summary = bedrock_client.generate_invoice_summary(invoice_data)

        response_data = {
            "invoice_id": invoice.invoice_id,
            "status": invoice.status.value,
            "created_at": invoice.created_at.isoformat(),
            "summary": summary,
            "data": invoice.data.to_dynamodb()
        }

        return create_success_response(response_data, status_code=201)

    except InputValidationError as e:
        logger.warning("Input validation error", error=e)
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
