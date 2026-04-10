"""
Lambda function: Stripe Payment Webhook Handler
Handles payment events from Stripe Connect for invoice payment links.
Marks invoices as paid when customers complete checkout.
"""

import json
import os
import sys
from typing import Any, Dict, Optional
from datetime import datetime

# Add layer to path
sys.path.insert(0, '/opt/python')

import boto3
import stripe
from botocore.exceptions import ClientError

from common.logger import get_logger

logger = get_logger("payment_webhook")

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
WEBHOOK_SECRET = os.environ.get('STRIPE_PAYMENT_WEBHOOK_SECRET', '')

# DynamoDB
INVOICES_TABLE = os.environ.get('INVOICES_TABLE', 'ScatterPilot-Invoices-dev')
SUBSCRIPTIONS_TABLE = os.environ.get('SUBSCRIPTIONS_TABLE', 'ScatterPilot-Subscriptions-dev')
dynamodb = boto3.resource('dynamodb')
invoices_table = dynamodb.Table(INVOICES_TABLE)
subscriptions_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)


def verify_webhook_signature(body: str, sig_header: str) -> Optional[Dict[str, Any]]:
    """
    Verify Stripe webhook signature and construct event

    Args:
        body: Raw request body
        sig_header: Stripe-Signature header value

    Returns:
        Verified webhook event or None if verification fails
    """
    try:
        webhook_event = stripe.Webhook.construct_event(
            body, sig_header, WEBHOOK_SECRET
        )
        return webhook_event
    except ValueError as e:
        logger.error("Invalid webhook payload", error=str(e))
        return None
    except stripe.error.SignatureVerificationError as e:
        logger.error("Invalid webhook signature", error=str(e))
        return None


def get_invoice_by_id(invoice_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve invoice from DynamoDB

    Args:
        invoice_id: Invoice identifier

    Returns:
        Invoice data or None if not found
    """
    try:
        response = invoices_table.get_item(Key={'invoice_id': invoice_id})
        return response.get('Item')
    except ClientError as e:
        logger.error("Failed to get invoice", error=str(e), invoice_id=invoice_id)
        return None


def update_invoice_payment_status(
    invoice_id: str,
    payment_intent_id: str,
    amount_paid: int,
    stripe_account_id: str
) -> bool:
    """
    Update invoice with payment information

    Args:
        invoice_id: Invoice identifier
        payment_intent_id: Stripe payment intent ID
        amount_paid: Amount paid in cents
        stripe_account_id: Connected Stripe account ID

    Returns:
        True if update succeeded, False otherwise
    """
    try:
        now = datetime.utcnow().isoformat()

        # Update invoice with payment details
        invoices_table.update_item(
            Key={'invoice_id': invoice_id},
            UpdateExpression='''
                SET #status = :status,
                    payment_status = :payment_status,
                    paid_at = :paid_at,
                    payment_id = :payment_id,
                    payment_amount = :payment_amount,
                    payment_stripe_account = :stripe_account,
                    updated_at = :updated_at
            ''',
            ExpressionAttributeNames={
                '#status': 'status'  # 'status' is a reserved word in DynamoDB
            },
            ExpressionAttributeValues={
                ':status': 'paid',
                ':payment_status': 'paid',
                ':paid_at': now,
                ':payment_id': payment_intent_id,
                ':payment_amount': amount_paid,
                ':stripe_account': stripe_account_id,
                ':updated_at': now
            },
            ConditionExpression='attribute_exists(invoice_id)'
        )

        logger.info(
            "Invoice marked as paid",
            invoice_id=invoice_id,
            payment_id=payment_intent_id,
            amount_cents=amount_paid
        )
        return True

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == 'ConditionalCheckFailedException':
            logger.warning("Invoice not found for update", invoice_id=invoice_id)
        else:
            logger.error(
                "Failed to update invoice payment status",
                error=str(e),
                invoice_id=invoice_id
            )
        return False


def handle_checkout_session_completed(session: Dict[str, Any], stripe_account_id: str) -> bool:
    """
    Handle checkout.session.completed event

    Args:
        session: Stripe checkout session object
        stripe_account_id: Connected account ID (from webhook event)

    Returns:
        True if processed successfully
    """
    # Extract invoice_id from session metadata
    metadata = session.get('metadata', {})
    invoice_id = metadata.get('invoice_id')

    if not invoice_id:
        logger.warning(
            "No invoice_id in checkout session metadata",
            session_id=session.get('id')
        )
        return False

    # Get payment details
    payment_intent_id = session.get('payment_intent')
    amount_total = session.get('amount_total', 0)  # Amount in cents
    payment_status = session.get('payment_status')

    logger.info(
        "Processing checkout completion",
        invoice_id=invoice_id,
        session_id=session.get('id'),
        payment_intent=payment_intent_id,
        amount_total=amount_total,
        payment_status=payment_status,
        stripe_account=stripe_account_id
    )

    # Verify payment was successful
    if payment_status != 'paid':
        logger.warning(
            "Checkout completed but payment not confirmed",
            invoice_id=invoice_id,
            payment_status=payment_status
        )
        return False

    # Check if invoice exists and is not already paid (idempotency)
    invoice = get_invoice_by_id(invoice_id)

    if not invoice:
        logger.warning("Invoice not found", invoice_id=invoice_id)
        return False

    current_status = invoice.get('status')
    if current_status == 'paid':
        logger.info(
            "Invoice already marked as paid (idempotent)",
            invoice_id=invoice_id,
            existing_payment_id=invoice.get('payment_id')
        )
        return True  # Already processed, return success

    # Update invoice with payment details
    success = update_invoice_payment_status(
        invoice_id=invoice_id,
        payment_intent_id=payment_intent_id,
        amount_paid=amount_total,
        stripe_account_id=stripe_account_id
    )

    if success:
        logger.info(
            "Invoice payment processed successfully",
            invoice_id=invoice_id,
            amount_cents=amount_total,
            customer_email=session.get('customer_details', {}).get('email')
        )
        # Track first_payment milestone (best-effort)
        try:
            from common.dynamodb_helper import DynamoDBHelper
            owner_id = invoice.get('user_id')
            if owner_id:
                db_helper = DynamoDBHelper()
                db_helper.track_payment_received(owner_id)
        except Exception:
            pass

    return success


def handle_payment_intent_succeeded(payment_intent: Dict[str, Any], stripe_account_id: str) -> bool:
    """
    Handle payment_intent.succeeded event (backup handler)

    This is a fallback in case checkout.session.completed is missed.

    Args:
        payment_intent: Stripe payment intent object
        stripe_account_id: Connected account ID

    Returns:
        True if processed successfully
    """
    metadata = payment_intent.get('metadata', {})
    invoice_id = metadata.get('invoice_id')

    if not invoice_id:
        # Payment intent might not have invoice metadata if created differently
        logger.debug(
            "No invoice_id in payment intent metadata",
            payment_intent_id=payment_intent.get('id')
        )
        return False

    # Check if already processed
    invoice = get_invoice_by_id(invoice_id)
    if not invoice:
        logger.warning("Invoice not found", invoice_id=invoice_id)
        return False

    if invoice.get('status') == 'paid':
        logger.info(
            "Invoice already paid (from payment_intent event)",
            invoice_id=invoice_id
        )
        return True

    amount = payment_intent.get('amount_received', 0)

    logger.info(
        "Processing payment intent success",
        invoice_id=invoice_id,
        payment_intent_id=payment_intent.get('id'),
        amount=amount
    )

    return update_invoice_payment_status(
        invoice_id=invoice_id,
        payment_intent_id=payment_intent.get('id'),
        amount_paid=amount,
        stripe_account_id=stripe_account_id
    )


def handle_account_updated(account: Dict[str, Any]) -> bool:
    """
    Handle account.updated Connect event.

    When a connected account's verification status changes (e.g., charges_enabled
    flips to True after identity verification), sync stripe_connect_status in the
    SubscriptionsTable.

    The connected account's metadata contains 'scatterpilot_user_id' (set at account
    creation time in connect_account.py), so we can look up the user directly without
    a table scan.

    TODO: Register this webhook in the Stripe dashboard under Connect > Webhooks
          (or the platform-level webhook endpoint) so account.updated events are delivered.
    """
    account_id = account.get('id')
    charges_enabled = account.get('charges_enabled', False)
    metadata = account.get('metadata', {})
    user_id = metadata.get('scatterpilot_user_id')

    if not user_id:
        logger.warning(
            "account.updated event missing scatterpilot_user_id in metadata",
            account_id=account_id
        )
        return False

    new_status = 'active' if charges_enabled else 'pending'

    try:
        subscriptions_table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='SET stripe_connect_status = :status, updated_at = :now',
            ExpressionAttributeValues={
                ':status': new_status,
                ':now': datetime.utcnow().isoformat(),
            },
            ConditionExpression='attribute_exists(user_id)',
        )
        logger.info(
            "Synced connect status from account.updated",
            account_id=account_id,
            user_id=user_id,
            new_status=new_status,
        )
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == 'ConditionalCheckFailedException':
            logger.warning("User not found for account.updated", user_id=user_id, account_id=account_id)
        else:
            logger.error("Failed to update connect status", error=str(e))
        return False


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for Stripe Connect payment webhooks

    Handles events from connected accounts:
    - checkout.session.completed: Customer completed payment link checkout
    - payment_intent.succeeded: Payment was successful (backup)

    Returns:
        API Gateway response (200 OK for Stripe)
    """
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Get raw body and signature header
        body = event.get('body', '')
        headers = event.get('headers', {})

        # Stripe signature header (case-insensitive)
        sig_header = headers.get('Stripe-Signature') or \
                     headers.get('stripe-signature') or \
                     headers.get('STRIPE-SIGNATURE', '')

        if not sig_header:
            logger.error("Missing Stripe-Signature header")
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Missing signature header'})
            }

        # Verify webhook signature
        webhook_event = verify_webhook_signature(body, sig_header)

        if not webhook_event:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Invalid signature'})
            }

        event_type = webhook_event.get('type')
        event_id = webhook_event.get('id')
        event_data = webhook_event.get('data', {}).get('object', {})

        # For Connect webhooks, the account field contains the connected account ID
        stripe_account_id = webhook_event.get('account', '')

        logger.info(
            "Received payment webhook",
            event_type=event_type,
            event_id=event_id,
            stripe_account=stripe_account_id
        )

        # Handle supported event types
        processed = False

        if event_type == 'checkout.session.completed':
            processed = handle_checkout_session_completed(event_data, stripe_account_id)

        elif event_type == 'payment_intent.succeeded':
            processed = handle_payment_intent_succeeded(event_data, stripe_account_id)

        elif event_type == 'account.updated':
            processed = handle_account_updated(event_data)

        elif event_type == 'checkout.session.expired':
            # Log but don't process - session expired without payment
            logger.info(
                "Checkout session expired",
                session_id=event_data.get('id'),
                invoice_id=event_data.get('metadata', {}).get('invoice_id')
            )
            processed = True  # Acknowledged

        else:
            # Log unhandled event types but return success
            logger.info(f"Unhandled event type: {event_type}")
            processed = True  # Acknowledge receipt

        # Always return 200 to Stripe to acknowledge receipt
        # (even if processing failed - we'll handle retries via idempotency)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'received': True,
                'processed': processed,
                'event_id': event_id
            })
        }

    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in webhook body", error=str(e))
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Invalid JSON'})
        }

    except Exception as e:
        import traceback
        logger.error(
            "Unexpected error processing webhook",
            error=str(e),
            error_type=type(e).__name__,
            traceback=traceback.format_exc()
        )
        # Return 500 so Stripe will retry
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }
