"""
Lambda function: GET /billing/status

Returns the authenticated user's current subscription and trial status,
including conversion metrics and access level.

No body required — identity comes from the Cognito JWT.
"""

import json
import os
import sys

sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.access_control import get_user_access
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
    InputValidationError,
)
from common.logger import get_logger

logger = get_logger("billing_status")


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    request_id = getattr(context, 'aws_request_id', 'local')
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        db_helper = DynamoDBHelper()
        billing = db_helper.get_billing_status(user_id)

        if billing is None:
            # First-ever request — initialize trial and return the new status
            user_email = (
                event.get('requestContext', {})
                .get('authorizer', {})
                .get('claims', {})
                .get('email')
            )
            db_helper.initialize_trial(user_id=user_id, user_email=user_email)
            billing = db_helper.get_billing_status(user_id)

        # Determine effective access level
        record = db_helper.get_user_subscription(user_id) or {}
        access = get_user_access(record)

        response_data = {
            **billing,
            'access': access,
        }

        logger.info('Billing status returned', user_id=user_id, status=billing.get('subscription_status'))
        return create_success_response(response_data)

    except InputValidationError as e:
        return create_error_response(400, str(e), 'ValidationError')
    except DynamoDBException as e:
        logger.error('Database error', error=str(e))
        return create_error_response(500, 'Database error occurred', 'DatabaseError')
    except Exception as e:
        logger.error('Unexpected error', error=str(e))
        return create_error_response(500, 'An unexpected error occurred', 'InternalError')


def _cors():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
    }
