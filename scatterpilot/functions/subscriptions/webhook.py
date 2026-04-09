"""
Lambda function: Stripe Webhook Handler
Handles ScatterPilot platform subscription lifecycle events.

Registered endpoint: POST /webhook/stripe
Signing secret env var: STRIPE_WEBHOOK_SECRET

NOTE: This is ScatterPilot's own billing webhook (Solo/Pro/Agency plans).
      Invoice payment webhooks (Stripe Connect) are handled separately
      in functions/stripe/payment_webhook.py.
"""

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, Optional

sys.path.insert(0, '/opt/python')

import stripe

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.logger import get_logger

logger = get_logger("stripe_webhook")

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')


# ---------------------------------------------------------------------------
# Stripe status → ScatterPilot status mapping
# ---------------------------------------------------------------------------

def _stripe_status_to_sp(stripe_status: str) -> str:
    """Map a Stripe subscription status to a ScatterPilot subscription_status value."""
    return {
        'trialing': 'trialing',
        'active': 'active',
        'past_due': 'past_due',
        'unpaid': 'past_due',
        'canceled': 'canceled',
        'incomplete': 'past_due',
        'incomplete_expired': 'canceled',
        'paused': 'past_due',
    }.get(stripe_status, 'canceled')


def _extract_plan_period(metadata: Dict[str, Any]):
    """Extract plan/period strings from Stripe metadata; returns (plan, period) or (None, None)."""
    plan = metadata.get('plan')
    period = metadata.get('period')
    if plan in ('solo', 'pro', 'agency') and period in ('monthly', 'annual'):
        return plan, period
    return None, None


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for Stripe webhook events (subscription lifecycle).

    Handles:
    - checkout.session.completed        — user subscribed after checkout
    - customer.subscription.updated     — plan/status change
    - customer.subscription.deleted     — cancellation
    - invoice.payment_succeeded         — successful renewal
    - invoice.payment_failed            — payment failure → past_due
    """
    request_id = getattr(context, 'aws_request_id', 'local')
    logger.set_correlation_id(request_id)

    # ── Verify Stripe signature ──────────────────────────────────────────────
    body = event.get('body', '')
    sig_header = (
        event.get('headers', {}).get('Stripe-Signature')
        or event.get('headers', {}).get('stripe-signature', '')
    )

    try:
        webhook_event = stripe.Webhook.construct_event(body, sig_header, WEBHOOK_SECRET)
    except ValueError as e:
        logger.error("Invalid payload", error=str(e))
        return {'statusCode': 400, 'body': json.dumps({'error': 'Invalid payload'})}
    except stripe.error.SignatureVerificationError as e:
        logger.error("Invalid signature", error=str(e))
        return {'statusCode': 400, 'body': json.dumps({'error': 'Invalid signature'})}

    event_type = webhook_event['type']
    event_data = webhook_event['data']['object']
    logger.info(f"Received webhook event: {event_type}", event_id=webhook_event['id'])

    db_helper = DynamoDBHelper()

    try:
        if event_type == 'checkout.session.completed':
            _handle_checkout_completed(event_data, db_helper)

        elif event_type == 'customer.subscription.updated':
            _handle_subscription_updated(event_data, db_helper)

        elif event_type == 'customer.subscription.deleted':
            _handle_subscription_deleted(event_data, db_helper)

        elif event_type == 'invoice.payment_succeeded':
            _handle_payment_succeeded(event_data, db_helper)

        elif event_type == 'invoice.payment_failed':
            _handle_payment_failed(event_data, db_helper)

        else:
            logger.info(f"Unhandled event type: {event_type}")

    except Exception as e:
        import traceback
        logger.error(
            "Webhook processing error",
            error=str(e),
            error_type=type(e).__name__,
            traceback=traceback.format_exc(),
        )
        # Return 200 so Stripe doesn't retry indefinitely for non-transient errors.
        # Log the failure for manual investigation.

    return {'statusCode': 200, 'body': json.dumps({'received': True})}


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def _resolve_user_id(obj: Dict[str, Any], db_helper: DynamoDBHelper) -> Optional[str]:
    """
    Try to find a ScatterPilot user_id from a Stripe object.
    Checks metadata first, then falls back to a GSI lookup by stripe_customer_id.
    """
    # 1. Direct metadata
    user_id = obj.get('metadata', {}).get('scatterpilot_user_id')
    if user_id:
        return user_id

    # 2. GSI lookup by customer ID
    customer_id = obj.get('customer')
    if customer_id:
        record = db_helper.get_user_by_stripe_customer(customer_id)
        if record:
            return record.get('user_id')

    logger.error("Could not resolve user_id from Stripe object", stripe_id=obj.get('id'))
    return None


def _handle_checkout_completed(session: Dict[str, Any], db_helper: DynamoDBHelper):
    """
    checkout.session.completed — user finished the Stripe Checkout flow.
    Only acts on subscription-mode sessions (not one-off Connect payments).
    """
    if session.get('mode') != 'subscription':
        logger.info("Skipping non-subscription checkout.session.completed")
        return

    user_id = _resolve_user_id(session, db_helper)
    if not user_id:
        return

    customer_id = session.get('customer')
    subscription_id = session.get('subscription')

    # Retrieve full subscription to get plan metadata and status
    plan, period = _extract_plan_period(session.get('metadata', {}))
    sp_status = 'active'

    if subscription_id:
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            stripe_status = sub.get('status') if isinstance(sub, dict) else getattr(sub, 'status', 'active')
            sp_status = _stripe_status_to_sp(stripe_status)
            # If metadata wasn't on the session, try subscription metadata
            if not plan:
                sub_meta = sub.get('metadata', {}) if isinstance(sub, dict) else dict(getattr(sub, 'metadata', {}))
                plan, period = _extract_plan_period(sub_meta)
        except Exception as e:
            logger.warning(f"Could not retrieve subscription details: {e}")

    db_helper.update_billing_subscription(
        user_id=user_id,
        subscription_status=sp_status,
        subscription_plan=plan,
        subscription_period=period,
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        trial_expired=False,
    )

    # Reset monthly invoice count for the new billing period
    db_helper.reset_monthly_invoice_count(user_id)

    logger.info(
        "Checkout completed — subscription activated",
        user_id=user_id,
        plan=plan,
        period=period,
        status=sp_status,
    )


def _handle_subscription_updated(subscription: Dict[str, Any], db_helper: DynamoDBHelper):
    """
    customer.subscription.updated — plan change, renewal, status change, etc.
    """
    user_id = _resolve_user_id(subscription, db_helper)
    if not user_id:
        return

    subscription_id = subscription.get('id')
    stripe_status = subscription.get('status', '')
    sp_status = _stripe_status_to_sp(stripe_status)

    metadata = subscription.get('metadata', {})
    plan, period = _extract_plan_period(metadata)

    db_helper.update_billing_subscription(
        user_id=user_id,
        subscription_status=sp_status,
        subscription_plan=plan,
        subscription_period=period,
        stripe_subscription_id=subscription_id,
        trial_expired=(sp_status not in ('trialing', 'active')),
    )

    logger.info(
        "Subscription updated",
        user_id=user_id,
        subscription_id=subscription_id,
        stripe_status=stripe_status,
        sp_status=sp_status,
    )


def _handle_subscription_deleted(subscription: Dict[str, Any], db_helper: DynamoDBHelper):
    """
    customer.subscription.deleted — user canceled or subscription expired.
    """
    user_id = _resolve_user_id(subscription, db_helper)
    if not user_id:
        return

    subscription_id = subscription.get('id')

    db_helper.update_billing_subscription(
        user_id=user_id,
        subscription_status='canceled',
        stripe_subscription_id=subscription_id,
        trial_expired=True,
    )

    logger.info("Subscription deleted — status set to canceled", user_id=user_id)


def _handle_payment_succeeded(invoice: Dict[str, Any], db_helper: DynamoDBHelper):
    """
    invoice.payment_succeeded — successful renewal payment.
    Reset monthly invoice count and ensure status is 'active'.
    """
    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return  # one-off invoice, not a subscription renewal

    user_id = _resolve_user_id(invoice, db_helper)
    if not user_id:
        return

    db_helper.update_billing_subscription(
        user_id=user_id,
        subscription_status='active',
        trial_expired=False,
    )
    db_helper.reset_monthly_invoice_count(user_id)

    logger.info("Payment succeeded — monthly count reset", user_id=user_id)


def _handle_payment_failed(invoice: Dict[str, Any], db_helper: DynamoDBHelper):
    """
    invoice.payment_failed — payment failed; mark subscription as past_due.
    """
    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return

    user_id = _resolve_user_id(invoice, db_helper)
    if not user_id:
        return

    db_helper.update_billing_subscription(
        user_id=user_id,
        subscription_status='past_due',
    )

    logger.warning("Payment failed — subscription marked past_due", user_id=user_id)
