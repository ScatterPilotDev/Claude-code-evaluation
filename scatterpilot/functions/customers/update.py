"""
Lambda function: Update Customer Profile
Stores per-customer metadata (phone, notes) in the user's subscriptions record.
The subscriptions record is used as a convenient per-user key-value store for
customer profile overrides without requiring a separate DynamoDB table.
"""

import json
import os
import sys
import urllib.parse
from datetime import datetime
from typing import Any, Dict

sys.path.insert(0, '/opt/python')

import boto3
from botocore.exceptions import ClientError

from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response
)
from common.logger import get_logger

logger = get_logger("update_customer")

SUBSCRIPTIONS_TABLE = os.environ.get('SUBSCRIPTIONS_TABLE', 'ScatterPilot-Subscriptions')


def _upsert_profile(table, user_id: str, customer_key: str, profile: Dict) -> None:
    """
    Write profile into customer_profiles.<customer_key> on the subscription record.
    Initialises customer_profiles map if it doesn't exist yet.
    """
    # Ensure the top-level customer_profiles map exists
    table.update_item(
        Key={'user_id': user_id},
        UpdateExpression='SET customer_profiles = if_not_exists(customer_profiles, :empty)',
        ExpressionAttributeValues={':empty': {}}
    )
    # Write the individual customer profile
    table.update_item(
        Key={'user_id': user_id},
        UpdateExpression='SET customer_profiles.#k = :profile',
        ExpressionAttributeNames={'#k': customer_key},
        ExpressionAttributeValues={':profile': profile}
    )


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    PUT /customers/{customer_name}

    Body fields (all optional):
      phone, email, address, notes
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        raw_name = (event.get('pathParameters') or {}).get('customer_name', '')
        customer_name = urllib.parse.unquote_plus(raw_name).strip()
        if not customer_name:
            return create_error_response(400, "customer_name path parameter is required", "ValidationError")

        body = json.loads(event.get('body') or '{}')

        profile = {
            'customer_name': customer_name,
            'phone':   body.get('phone', ''),
            'email':   body.get('email', ''),
            'address': body.get('address', ''),
            'notes':   body.get('notes', ''),
            'updated_at': datetime.utcnow().isoformat()
        }

        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
        customer_key = customer_name.lower()

        try:
            _upsert_profile(table, user_id, customer_key, profile)
        except ClientError as e:
            logger.error("DynamoDB error storing customer profile", error=e)
            return create_error_response(500, "Failed to update customer profile", "DatabaseError")

        logger.info("Customer profile updated", customer_name=customer_name)
        return create_success_response({'customer_name': customer_name, 'profile': profile})

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
