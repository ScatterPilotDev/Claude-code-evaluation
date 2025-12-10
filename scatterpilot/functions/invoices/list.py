"""
Lambda function: List Invoices
Retrieves paginated list of user's invoices
"""

import json
import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import InvoiceStatus
from common.security import (
    extract_user_id_from_event,
    validate_pagination_params,
    create_error_response,
    create_success_response,
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("list_invoices")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for listing user invoices

    Query parameters:
    - limit: Number of items to return (default: 20, max: 100)
    - last_key: Pagination token from previous response
    - status: Optional status filter (draft, pending, paid, cancelled)

    Returns:
        API Gateway response with invoice list
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}

        # Validate pagination parameters
        limit = query_params.get('limit')
        if limit:
            limit = int(limit)

        validated_limit, _ = validate_pagination_params(limit, 0)

        # Get pagination token
        last_key = query_params.get('last_key')
        last_evaluated_key = None
        if last_key:
            try:
                last_evaluated_key = json.loads(last_key)
            except json.JSONDecodeError:
                return create_error_response(
                    400,
                    "Invalid pagination token",
                    "ValidationError"
                )

        # Parse status filter
        status_filter = None
        status_param = query_params.get('status')
        if status_param:
            try:
                status_filter = InvoiceStatus(status_param.lower())
            except ValueError:
                return create_error_response(
                    400,
                    f"Invalid status. Must be one of: draft, pending, paid, cancelled",
                    "ValidationError"
                )

        # Retrieve invoices from database
        db_helper = DynamoDBHelper()
        invoices, next_key = db_helper.list_user_invoices(
            user_id=user_id,
            limit=validated_limit,
            last_evaluated_key=last_evaluated_key,
            status_filter=status_filter
        )

        # Format response
        invoice_list = []
        for invoice in invoices:
            invoice_list.append({
                "invoice_id": invoice.invoice_id,
                "status": invoice.status.value,
                "customer_name": invoice.data.customer_name,
                "invoice_date": invoice.data.invoice_date.isoformat(),
                "due_date": invoice.data.due_date.isoformat(),
                "total": str(invoice.data.total),
                "created_at": invoice.created_at.isoformat(),
                "has_pdf": invoice.pdf_s3_key is not None
            })

        response_data = {
            "invoices": invoice_list,
            "count": len(invoice_list)
        }

        # Add pagination token if there are more results
        if next_key:
            response_data["next_page_token"] = json.dumps(next_key)

        logger.info(
            "Retrieved invoices",
            count=len(invoice_list),
            has_more=next_key is not None
        )

        return create_success_response(response_data)

    except InputValidationError as e:
        logger.warning("Input validation error", error=e)
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except ValueError as e:
        logger.warning("Invalid parameter", error=e)
        return create_error_response(400, str(e), "ValidationError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
