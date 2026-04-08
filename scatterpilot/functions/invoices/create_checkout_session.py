"""
Lambda function: Create Stripe Checkout Session for Invoice Payment
POST /invoices/{invoice_id}/payment-link

Creates a fresh Stripe Checkout Session each time (sessions expire in 24 h,
so we don't cache the URL — just the session ID for audit purposes).

Uses destination charges so funds transfer to the freelancer's Standard
connected account while the platform creates the session under its own key.

Returns: { paymentUrl, sessionId }
"""

import json
import os
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation

sys.path.insert(0, '/opt/python')

import boto3
import stripe
from botocore.exceptions import ClientError

from common.security import extract_user_id_from_event
from common.logger import get_logger

logger = get_logger("create_checkout_session")

stripe.api_key = os.environ['STRIPE_SECRET_KEY']
FRONTEND_URL = os.environ['FRONTEND_URL']
INVOICES_TABLE = os.environ['INVOICES_TABLE']
SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']

dynamodb = boto3.resource('dynamodb')
invoices_table = dynamodb.Table(INVOICES_TABLE)
subscriptions_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}


def error(status, message):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps({'error': message}),
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        user_id = extract_user_id_from_event(event)
        invoice_id = event.get('pathParameters', {}).get('invoice_id')

        if not invoice_id:
            return error(400, 'invoice_id is required')

        logger.info(f"Creating checkout session for invoice {invoice_id}, user {user_id}")

        # ── Fetch invoice ──────────────────────────────────────────────────────
        inv_resp = invoices_table.get_item(Key={'invoice_id': invoice_id})
        invoice = inv_resp.get('Item')

        if not invoice:
            return error(404, 'Invoice not found')

        if invoice.get('user_id') != user_id:
            return error(403, 'Not authorized to access this invoice')

        if invoice.get('status') == 'paid':
            return error(400, 'Invoice is already paid')

        if invoice.get('status') == 'cancelled':
            return error(400, 'Cannot create payment link for a cancelled invoice')

        # ── Fetch connected account ID ─────────────────────────────────────────
        sub_resp = subscriptions_table.get_item(Key={'user_id': user_id})
        user_data = sub_resp.get('Item', {})
        connected_account_id = user_data.get('stripe_connected_account_id')

        if not connected_account_id:
            return error(400, 'Connect your Stripe account in Settings before accepting payments')

        # ── Build line-item metadata ───────────────────────────────────────────
        data = invoice.get('data', {})
        invoice_number = data.get('invoice_number') or invoice_id[:8].upper()
        customer_name = data.get('customer_name', 'Customer')
        total_str = data.get('total', '0')

        try:
            amount_cents = int(Decimal(str(total_str)) * 100)
        except (InvalidOperation, ValueError):
            return error(400, 'Invalid invoice total amount')

        if amount_cents <= 0:
            return error(400, 'Invoice total must be greater than zero')

        line_items = data.get('line_items', [])
        desc_parts = [li.get('description', 'Item') for li in line_items[:5] if li.get('description')]
        product_description = ', '.join(desc_parts) if desc_parts else 'Professional services'
        if len(product_description) > 500:
            product_description = product_description[:497] + '...'

        # ── Create Stripe Checkout Session ─────────────────────────────────────
        session = stripe.checkout.sessions.create(
            mode='payment',
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'Invoice #{invoice_number} — {customer_name}',
                        'description': product_description,
                    },
                    'unit_amount': amount_cents,
                },
                'quantity': 1,
            }],
            payment_intent_data={
                # Destination charge — funds flow to the connected account.
                # No platform fee: ScatterPilot monetises via subscriptions only.
                'transfer_data': {
                    'destination': connected_account_id,
                },
                'metadata': {
                    'invoice_id': invoice_id,
                    'scatterpilot_user_id': user_id,
                },
            },
            success_url=f'{FRONTEND_URL}/pay/{invoice_id}/success',
            cancel_url=f'{FRONTEND_URL}/pay/{invoice_id}',
            metadata={
                'invoice_id': invoice_id,
                'scatterpilot_user_id': user_id,
            },
        )

        logger.info(f"Created checkout session {session.id} for invoice {invoice_id}")

        # ── Persist session ID for audit ───────────────────────────────────────
        now = datetime.utcnow().isoformat()
        invoices_table.update_item(
            Key={'invoice_id': invoice_id},
            UpdateExpression=(
                'SET checkout_session_id = :sid, '
                'checkout_session_created_at = :now, '
                'updated_at = :now'
            ),
            ExpressionAttributeValues={
                ':sid': session.id,
                ':now': now,
            },
        )

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'paymentUrl': session.url,
                'sessionId': session.id,
            }),
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        return error(502, f'Stripe error: {str(e)}')
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return error(500, 'Database error')
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return error(500, 'Failed to create payment link')
