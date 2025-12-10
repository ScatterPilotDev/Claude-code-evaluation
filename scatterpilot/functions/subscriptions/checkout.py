"""
Lambda function: Create Stripe Checkout Session
Creates a checkout session for upgrading to Pro plan
"""

import json
import os
import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

import stripe

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
)
from common.logger import get_logger

logger = get_logger("checkout_session")

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for creating Stripe checkout sessions

    Returns:
        API Gateway response with checkout session URL
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID from Cognito token
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Parse request body
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body) if body else {}

        # Get URLs from request or use defaults
        success_url = body.get('success_url', os.environ.get('FRONTEND_URL', 'http://localhost:5173') + '/success')
        cancel_url = body.get('cancel_url', os.environ.get('FRONTEND_URL', 'http://localhost:5173') + '/pricing')

        # Get user email from Cognito claims if available
        user_email = None
        if event.get('requestContext', {}).get('authorizer', {}).get('claims'):
            user_email = event['requestContext']['authorizer']['claims'].get('email')

        db_helper = DynamoDBHelper()

        # Check if user already has a subscription
        user_subscription = db_helper.get_user_subscription(user_id)

        if user_subscription and user_subscription.get('subscription_status') == 'pro':
            return create_error_response(
                400,
                "User already has an active Pro subscription",
                "AlreadySubscribed"
            )

        # Get or create Stripe customer
        stripe_customer_id = None
        if user_subscription and user_subscription.get('stripe_customer_id'):
            stripe_customer_id = user_subscription['stripe_customer_id']
        else:
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=user_email,
                metadata={
                    'user_id': user_id
                }
            )
            stripe_customer_id = customer.id

            # Save customer ID to database
            db_helper.create_or_update_user_subscription(
                user_id=user_id,
                stripe_customer_id=stripe_customer_id,
                subscription_status='free'
            )

        # Create checkout session
        price_id = os.environ.get('STRIPE_PRO_PRICE_ID')
        if not price_id:
            logger.error("STRIPE_PRO_PRICE_ID not configured")
            return create_error_response(500, "Stripe price not configured", "ConfigurationError")

        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1
            }],
            mode='subscription',
            success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=cancel_url,
            metadata={
                'user_id': user_id
            },
            subscription_data={
                'metadata': {
                    'user_id': user_id
                }
            }
        )

        logger.info(
            "Checkout session created",
            session_id=session.id,
            user_id=user_id
        )

        return create_success_response({
            'session_id': session.id,
            'url': session.url
        })

    except stripe.error.StripeError as e:
        logger.error("Stripe API error", error=str(e))
        return create_error_response(500, f"Payment service error: {str(e)}", "StripeError")

    except DynamoDBException as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")


def create_portal_session(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for creating Stripe customer portal session
    Allows users to manage their subscription

    Returns:
        API Gateway response with portal session URL
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
            body = json.loads(body) if body else {}

        return_url = body.get('return_url', os.environ.get('FRONTEND_URL', 'http://localhost:5173') + '/account')

        db_helper = DynamoDBHelper()

        # Get user's Stripe customer ID
        user_subscription = db_helper.get_user_subscription(user_id)

        if not user_subscription or not user_subscription.get('stripe_customer_id'):
            return create_error_response(404, "No subscription found", "NotFound")

        # Create portal session
        session = stripe.billing_portal.Session.create(
            customer=user_subscription['stripe_customer_id'],
            return_url=return_url
        )

        logger.info(
            "Portal session created",
            session_id=session.id,
            user_id=user_id
        )

        return create_success_response({
            'url': session.url
        })

    except stripe.error.StripeError as e:
        logger.error("Stripe API error", error=str(e))
        return create_error_response(500, f"Payment service error: {str(e)}", "StripeError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")
