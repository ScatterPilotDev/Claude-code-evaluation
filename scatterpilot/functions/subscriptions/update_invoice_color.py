"""
Lambda function: Update Invoice Color Preference
Allows Pro users to customize their invoice color theme
"""

import json
import os
import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("update_invoice_color")

# Valid color options for Pro users
VALID_COLORS = ['purple', 'blue', 'green', 'orange', 'red']


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for updating invoice color preference

    Request body:
    {
        "invoice_color": "purple" | "blue" | "green" | "orange" | "red"
    }

    Returns:
        API Gateway response with updated preference
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Parse request body
        try:
            body = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return create_error_response(400, "Invalid JSON in request body", "ValidationError")

        invoice_color = body.get('invoice_color')

        # Validate color choice
        if not invoice_color:
            return create_error_response(400, "invoice_color is required", "ValidationError")

        if invoice_color not in VALID_COLORS:
            return create_error_response(
                400,
                f"Invalid color. Must be one of: {', '.join(VALID_COLORS)}",
                "ValidationError"
            )

        # Get user subscription
        db_helper = DynamoDBHelper()
        subscription = db_helper.get_user_subscription(user_id)

        # Check if user has Pro subscription
        if not subscription or subscription.get('subscription_status') != 'pro':
            return create_error_response(
                403,
                "Invoice color customization is only available for Pro users",
                "Forbidden"
            )

        # Update invoice color preference
        db_helper.update_user_invoice_color(user_id, invoice_color)

        logger.info("Invoice color preference updated", color=invoice_color)

        return create_success_response({
            'invoice_color': invoice_color,
            'message': 'Invoice color preference updated successfully'
        })

    except InputValidationError as e:
        logger.warning("Input validation error", error=str(e))
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")
