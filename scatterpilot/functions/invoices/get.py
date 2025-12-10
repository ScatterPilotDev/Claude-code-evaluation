"""
Lambda function: Get Invoice
Retrieves a single invoice by ID
"""

import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    validate_uuid,
    create_error_response,
    create_success_response,
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("get_invoice")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for retrieving a single invoice

    Path parameters:
    - invoice_id: Invoice identifier

    Returns:
        API Gateway response with invoice details
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Get invoice ID from path parameters
        path_params = event.get('pathParameters') or {}
        invoice_id = path_params.get('invoice_id')

        if not invoice_id:
            return create_error_response(
                400,
                "Invoice ID is required",
                "ValidationError"
            )

        # Validate UUID format
        try:
            invoice_id = validate_uuid(invoice_id, "Invoice ID")
        except InputValidationError as e:
            return create_error_response(400, str(e), "ValidationError")

        # Retrieve invoice from database
        db_helper = DynamoDBHelper()
        invoice = db_helper.get_invoice(invoice_id)

        if not invoice:
            logger.warning("Invoice not found", invoice_id=invoice_id)
            return create_error_response(404, "Invoice not found", "NotFound")

        # Verify ownership
        if invoice.user_id != user_id:
            logger.warning(
                "Unauthorized invoice access",
                invoice_id=invoice_id,
                user_id=user_id
            )
            return create_error_response(403, "Not authorized to access this invoice", "Forbidden")

        # Format response with full invoice details
        response_data = {
            "invoice_id": invoice.invoice_id,
            "status": invoice.status.value,
            "created_at": invoice.created_at.isoformat(),
            "updated_at": invoice.updated_at.isoformat(),
            "conversation_id": invoice.conversation_id,
            "data": {
                "customer_name": invoice.data.customer_name,
                "customer_email": invoice.data.customer_email,
                "customer_address": invoice.data.customer_address,
                "invoice_date": invoice.data.invoice_date.isoformat(),
                "due_date": invoice.data.due_date.isoformat(),
                "invoice_number": invoice.data.invoice_number,
                "line_items": [
                    {
                        "description": item.description,
                        "quantity": str(item.quantity),
                        "unit_price": str(item.unit_price),
                        "total": str(item.total)
                    }
                    for item in invoice.data.line_items
                ],
                "subtotal": str(invoice.data.subtotal),
                "discount": str(invoice.data.discount),
                "tax_rate": str(invoice.data.tax_rate),
                "tax_amount": str(invoice.data.tax_amount),
                "total": str(invoice.data.total),
                "notes": invoice.data.notes
            },
            "pdf_available": invoice.pdf_s3_key is not None,
            "pdf_s3_key": invoice.pdf_s3_key
        }

        logger.info("Retrieved invoice", invoice_id=invoice_id)

        return create_success_response(response_data)

    except InputValidationError as e:
        logger.warning("Input validation error", error=e)
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
