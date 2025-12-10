"""
Lambda function: Stripe Webhook Handler
Handles subscription lifecycle events from Stripe
"""

import json
import os
import sys
from typing import Any, Dict
from datetime import datetime

# Add layer to path
sys.path.insert(0, '/opt/python')

import stripe

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.logger import get_logger

logger = get_logger("stripe_webhook")

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for Stripe webhooks

    Handles events:
    - checkout.session.completed: User completed checkout
    - customer.subscription.updated: Subscription status changed
    - customer.subscription.deleted: Subscription cancelled
    - invoice.payment_succeeded: Monthly payment succeeded
    - invoice.payment_failed: Payment failed

    Returns:
        API Gateway response
    """
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Get raw body and signature
        body = event.get('body', '')
        sig_header = event.get('headers', {}).get('Stripe-Signature') or \
                     event.get('headers', {}).get('stripe-signature', '')

        # Verify webhook signature
        try:
            webhook_event = stripe.Webhook.construct_event(
                body, sig_header, WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error("Invalid payload", error=str(e))
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid payload'})
            }
        except stripe.error.SignatureVerificationError as e:
            logger.error("Invalid signature", error=str(e))
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid signature'})
            }

        event_type = webhook_event['type']
        event_data = webhook_event['data']['object']

        logger.info(f"Received webhook event: {event_type}", event_id=webhook_event['id'])

        db_helper = DynamoDBHelper()

        # Handle different event types
        if event_type == 'checkout.session.completed':
            handle_checkout_completed(event_data, db_helper)

        elif event_type == 'customer.subscription.updated':
            handle_subscription_updated(event_data, db_helper)

        elif event_type == 'customer.subscription.deleted':
            handle_subscription_deleted(event_data, db_helper)

        elif event_type == 'invoice.payment_succeeded':
            handle_payment_succeeded(event_data, db_helper)

        elif event_type == 'invoice.payment_failed':
            handle_payment_failed(event_data, db_helper)

        else:
            logger.info(f"Unhandled event type: {event_type}")

        return {
            'statusCode': 200,
            'body': json.dumps({'received': True})
        }

    except Exception as e:
        import traceback
        logger.error(
            "Webhook processing error",
            error=str(e),
            error_type=type(e).__name__,
            traceback=traceback.format_exc()
        )
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_checkout_completed(session: Dict[str, Any], db_helper: DynamoDBHelper):
    """Handle successful checkout - upgrade user to Pro"""

    user_id = session.get('metadata', {}).get('user_id')
    customer_id = session.get('customer')
    subscription_id = session.get('subscription')

    if not user_id:
        logger.error("No user_id in checkout session metadata")
        return

    logger.info(
        "Checkout completed",
        user_id=user_id,
        subscription_id=subscription_id
    )

    # Get subscription details for period end
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        # Handle both dict and object access patterns
        if isinstance(subscription, dict):
            current_period_end = subscription.get('current_period_end')
        else:
            current_period_end = getattr(subscription, 'current_period_end', None)

        logger.info(f"Subscription retrieved, period_end: {current_period_end}")
    except Exception as e:
        logger.error(f"Failed to retrieve subscription: {str(e)}, type: {type(e).__name__}")
        # Still update the subscription without period_end
        current_period_end = None

    # Update user subscription status
    db_helper.create_or_update_user_subscription(
        user_id=user_id,
        stripe_customer_id=customer_id,
        subscription_id=subscription_id,
        subscription_status='pro',
        current_period_end=current_period_end
    )

    # Reset invoice count for the new billing period
    db_helper.reset_monthly_invoice_count(user_id)

    logger.info(f"User {user_id} upgraded to Pro")


def handle_subscription_updated(subscription: Dict[str, Any], db_helper: DynamoDBHelper):
    """Handle subscription updates (status changes, renewals)"""

    user_id = subscription.get('metadata', {}).get('user_id')
    subscription_id = subscription.get('id')
    status = subscription.get('status')
    current_period_end = subscription.get('current_period_end')

    if not user_id:
        # Try to find user by customer ID
        customer_id = subscription.get('customer')
        user_subscription = db_helper.get_user_by_stripe_customer(customer_id)
        if user_subscription:
            user_id = user_subscription['user_id']
        else:
            logger.error("Could not find user for subscription update")
            return

    logger.info(
        "Subscription updated",
        user_id=user_id,
        subscription_id=subscription_id,
        status=status
    )

    # Map Stripe status to our status
    if status in ['active', 'trialing']:
        subscription_status = 'pro'
    elif status in ['past_due', 'unpaid']:
        subscription_status = 'pro'  # Keep pro but flag as past due
    elif status in ['canceled', 'incomplete_expired']:
        subscription_status = 'cancelled'
    else:
        subscription_status = 'free'

    # Update subscription
    db_helper.create_or_update_user_subscription(
        user_id=user_id,
        subscription_status=subscription_status,
        subscription_id=subscription_id,
        current_period_end=current_period_end
    )


def handle_subscription_deleted(subscription: Dict[str, Any], db_helper: DynamoDBHelper):
    """Handle subscription cancellation - downgrade to Free"""

    user_id = subscription.get('metadata', {}).get('user_id')
    subscription_id = subscription.get('id')

    if not user_id:
        # Try to find user by customer ID
        customer_id = subscription.get('customer')
        user_subscription = db_helper.get_user_by_stripe_customer(customer_id)
        if user_subscription:
            user_id = user_subscription['user_id']
        else:
            logger.error("Could not find user for subscription deletion")
            return

    logger.info(
        "Subscription deleted",
        user_id=user_id,
        subscription_id=subscription_id
    )

    # Downgrade to free
    db_helper.create_or_update_user_subscription(
        user_id=user_id,
        subscription_status='free',
        subscription_id=None,
        current_period_end=None
    )

    # Reset invoice count (will now be limited to 5/month)
    db_helper.reset_monthly_invoice_count(user_id)

    logger.info(f"User {user_id} downgraded to Free")


def handle_payment_succeeded(invoice: Dict[str, Any], db_helper: DynamoDBHelper):
    """Handle successful payment - reset monthly invoice count"""

    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')

    if not subscription_id:
        # Not a subscription invoice
        return

    # Find user by customer ID
    user_subscription = db_helper.get_user_by_stripe_customer(customer_id)
    if not user_subscription:
        logger.warning(f"No user found for customer {customer_id}")
        return

    user_id = user_subscription['user_id']

    logger.info(
        "Payment succeeded",
        user_id=user_id,
        invoice_id=invoice.get('id')
    )

    # Get subscription for updated period
    subscription = stripe.Subscription.retrieve(subscription_id)

    # Update period end and reset invoice count for new billing period
    db_helper.create_or_update_user_subscription(
        user_id=user_id,
        current_period_end=subscription.current_period_end
    )

    # Reset monthly invoice count
    db_helper.reset_monthly_invoice_count(user_id)

    logger.info(f"Monthly invoice count reset for user {user_id}")


def handle_payment_failed(invoice: Dict[str, Any], db_helper: DynamoDBHelper):
    """Handle failed payment"""

    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')

    if not subscription_id:
        return

    # Find user by customer ID
    user_subscription = db_helper.get_user_by_stripe_customer(customer_id)
    if not user_subscription:
        logger.warning(f"No user found for customer {customer_id}")
        return

    user_id = user_subscription['user_id']

    logger.warning(
        "Payment failed",
        user_id=user_id,
        invoice_id=invoice.get('id')
    )

    # Could add logic here to send email notification, etc.
    # For now just log the failure
