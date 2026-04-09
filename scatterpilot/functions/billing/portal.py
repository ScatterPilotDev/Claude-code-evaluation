"""
Lambda function: POST /billing/portal

Creates a Stripe Customer Portal session so the authenticated user can
manage their ScatterPilot subscription — upgrade, downgrade, cancel, or
update their payment method.

Returns:
  { "url": "https://billing.stripe.com/..." }
"""

import json
import os
import sys

sys.path.insert(0, '/opt/python')

import stripe

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
    InputValidationError,
)
from common.logger import get_logger

logger = get_logger("billing_portal")

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://scatterpilot.com')


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    request_id = getattr(context, 'aws_request_id', 'local')
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        db_helper = DynamoDBHelper()
        record = db_helper.get_user_subscription(user_id)

        stripe_customer_id = record.get('stripe_customer_id') if record else None
        if not stripe_customer_id:
            return create_error_response(
                404,
                'No billing account found. Subscribe to a plan first.',
                'NotFound',
            )

        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=f'{FRONTEND_URL}/app/settings',
        )

        logger.info('Billing portal session created', session_id=session.id)
        return create_success_response({'url': session.url})

    except InputValidationError as e:
        return create_error_response(400, str(e), 'ValidationError')
    except stripe.error.StripeError as e:
        logger.error('Stripe error', error=str(e))
        return create_error_response(502, f'Payment provider error: {str(e)}', 'StripeError')
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
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
    }
