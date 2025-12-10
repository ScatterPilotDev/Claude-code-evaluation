"""
Lambda function: Get User Subscription
Returns subscription status and usage for the current user
"""

import json
import os
import sys
from typing import Any, Dict
from datetime import datetime

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
)
from common.logger import get_logger

logger = get_logger("get_subscription")

FREE_TIER_LIMIT = 5


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for getting user subscription status

    Returns:
        API Gateway response with subscription details
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        db_helper = DynamoDBHelper()

        # Get user subscription
        subscription = db_helper.get_user_subscription(user_id)

        if not subscription:
            # No subscription record - return free tier defaults
            return create_success_response({
                'subscription_status': 'free',
                'invoices_this_month': 0,
                'invoices_limit': FREE_TIER_LIMIT,
                'invoices_remaining': FREE_TIER_LIMIT,
                'current_period_end': None,
                'can_create_invoice': True
            })

        # Calculate remaining invoices
        is_pro = subscription.get('subscription_status') == 'pro'
        # CRITICAL FIX: Convert Decimal to int for JSON serialization
        invoices_this_month = int(subscription.get('invoices_this_month', 0))

        if is_pro:
            invoices_limit = None  # Unlimited
            invoices_remaining = None
            can_create_invoice = True
        else:
            invoices_limit = FREE_TIER_LIMIT
            invoices_remaining = max(0, FREE_TIER_LIMIT - invoices_this_month)
            can_create_invoice = invoices_remaining > 0

        # Format period end if exists
        current_period_end = subscription.get('current_period_end')
        if current_period_end:
            current_period_end = datetime.fromtimestamp(current_period_end).isoformat()

        response_data = {
            'subscription_status': subscription.get('subscription_status', 'free'),
            'invoices_this_month': invoices_this_month,  # Now an int, not Decimal
            'invoices_limit': invoices_limit,
            'invoices_remaining': invoices_remaining,
            'current_period_end': current_period_end,
            'can_create_invoice': can_create_invoice,
            'stripe_customer_id': subscription.get('stripe_customer_id'),
            'invoice_color': subscription.get('invoice_color', 'purple')  # Default to purple for Pro users
        }

        logger.info("Subscription retrieved", status=subscription.get('subscription_status'))

        return create_success_response(response_data)

    except DynamoDBException as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")
