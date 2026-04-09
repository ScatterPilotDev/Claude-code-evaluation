"""
Lambda function: POST /billing/checkout

Creates a Stripe Checkout Session for subscribing to a ScatterPilot plan
(Solo / Pro / Agency, monthly or annual).  This is ScatterPilot's own
revenue flow — completely separate from Stripe Connect (which handles
invoice payments from freelancers' clients).

Input (JSON body):
  { "plan": "solo"|"pro"|"agency", "period": "monthly"|"annual" }

Returns:
  { "url": "https://checkout.stripe.com/..." }

TODO: Before deploying to production, create the products and prices in the
Stripe Dashboard and replace the placeholder values in SSM / CloudFormation
parameters:
  - STRIPE_PRICE_SOLO_MONTHLY
  - STRIPE_PRICE_SOLO_ANNUAL
  - STRIPE_PRICE_PRO_MONTHLY
  - STRIPE_PRICE_PRO_ANNUAL
  - STRIPE_PRICE_AGENCY_MONTHLY
  - STRIPE_PRICE_AGENCY_ANNUAL
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

logger = get_logger("billing_checkout")

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://scatterpilot.com')

# TODO: Replace these placeholder IDs with real Stripe Price IDs after creating
#       the products/prices in your Stripe Dashboard.
PRICE_MAP = {
    'solo_monthly':   os.environ.get('STRIPE_PRICE_SOLO_MONTHLY',   'price_solo_monthly_TODO'),
    'solo_annual':    os.environ.get('STRIPE_PRICE_SOLO_ANNUAL',     'price_solo_annual_TODO'),
    'pro_monthly':    os.environ.get('STRIPE_PRICE_PRO_MONTHLY',     'price_pro_monthly_TODO'),
    'pro_annual':     os.environ.get('STRIPE_PRICE_PRO_ANNUAL',      'price_pro_annual_TODO'),
    'agency_monthly': os.environ.get('STRIPE_PRICE_AGENCY_MONTHLY',  'price_agency_monthly_TODO'),
    'agency_annual':  os.environ.get('STRIPE_PRICE_AGENCY_ANNUAL',   'price_agency_annual_TODO'),
}

VALID_PLANS = {'solo', 'pro', 'agency'}
VALID_PERIODS = {'monthly', 'annual'}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    request_id = getattr(context, 'aws_request_id', 'local')
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        body = event.get('body') or '{}'
        if isinstance(body, str):
            body = json.loads(body)

        plan = (body.get('plan') or '').lower()
        period = (body.get('period') or '').lower()

        if plan not in VALID_PLANS:
            return create_error_response(400, f"plan must be one of: {', '.join(sorted(VALID_PLANS))}", 'ValidationError')
        if period not in VALID_PERIODS:
            return create_error_response(400, f"period must be one of: {', '.join(sorted(VALID_PERIODS))}", 'ValidationError')

        price_key = f'{plan}_{period}'
        price_id = PRICE_MAP[price_key]
        if price_id.endswith('_TODO'):
            logger.error(f"Stripe price ID not configured for {price_key}")
            return create_error_response(500, 'Payment configuration is not complete. Please contact support.', 'ConfigurationError')

        # Extract email from Cognito claims
        user_email = (
            event.get('requestContext', {})
            .get('authorizer', {})
            .get('claims', {})
            .get('email')
        )

        db_helper = DynamoDBHelper()
        record = db_helper.get_user_subscription(user_id)

        # Block if already active on ANY plan
        if record and record.get('subscription_status') == 'active':
            return create_error_response(400, 'You already have an active subscription. Visit the billing portal to change your plan.', 'AlreadySubscribed')

        # Get or create Stripe Customer
        stripe_customer_id = record.get('stripe_customer_id') if record else None
        if not stripe_customer_id:
            customer = stripe.Customer.create(
                email=user_email,
                metadata={'scatterpilot_user_id': user_id},
            )
            stripe_customer_id = customer.id
            # Persist immediately so we don't create duplicates on retries
            db_helper.update_billing_subscription(
                user_id=user_id,
                stripe_customer_id=stripe_customer_id,
            )

        session = stripe.checkout.sessions.create(
            customer=stripe_customer_id,
            mode='subscription',
            line_items=[{'price': price_id, 'quantity': 1}],
            success_url=f'{FRONTEND_URL}/app?subscribed=true',
            cancel_url=f'{FRONTEND_URL}/app/pricing',
            metadata={
                'scatterpilot_user_id': user_id,
                'plan': plan,
                'period': period,
            },
            subscription_data={
                'metadata': {
                    'scatterpilot_user_id': user_id,
                    'plan': plan,
                    'period': period,
                },
            },
        )

        logger.info('Billing checkout session created', session_id=session.id, plan=plan, period=period)
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
