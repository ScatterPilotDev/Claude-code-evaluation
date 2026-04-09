"""
Lambda function: Public Stripe Checkout Session for Invoice Payment
POST /invoices/{invoice_id}/public-checkout

No Cognito auth required — this endpoint is called by the invoice recipient
(client) from the public /pay/:invoiceId page.

Looks up the invoice by ID (no ownership check), finds the freelancer's
connected Stripe account, and creates a Checkout Session on their behalf
using a destination charge.

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

from common.logger import get_logger

logger = get_logger("public_checkout")

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
    'Access-Control-Allow-Headers': 'Content-Type',
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
        invoice_id = event.get('pathParameters', {}).get('invoice_id')
        if not invoice_id:
            return error(400, 'invoice_id is required')

        logger.info(f"Public checkout for invoice {invoice_id}")

        # ── Fetch invoice (no ownership check — public endpoint) ───────────────
        inv_resp = invoices_table.get_item(Key={'invoice_id': invoice_id})
        invoice = inv_resp.get('Item')

        if not invoice:
            return error(404, 'Invoice not found')

        status = invoice.get('status', '')
        if status == 'paid':
            return error(400, 'This invoice has already been paid')
        if status == 'cancelled':
            return error(400, 'This invoice has been cancelled and cannot be paid')

        # ── Fetch the freelancer's connected Stripe account ────────────────────
        owner_user_id = invoice.get('user_id')
        if not owner_user_id:
            return error(500, 'Invoice owner not found')

        sub_resp = subscriptions_table.get_item(Key={'user_id': owner_user_id})
        user_data = sub_resp.get('Item', {})
        connected_account_id = user_data.get('stripe_connected_account_id')

        if not connected_account_id:
            return error(400, 'Online payment is not available for this invoice')

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
            return error(400, 'Invoice total must be greater than zero to pay online')

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
                # Destination charge — funds flow to the freelancer's connected account
                'transfer_data': {
                    'destination': connected_account_id,
                },
                'metadata': {
                    'invoice_id': invoice_id,
                    'scatterpilot_user_id': owner_user_id,
                },
            },
            success_url=f'{FRONTEND_URL}/pay/{invoice_id}/success',
            cancel_url=f'{FRONTEND_URL}/pay/{invoice_id}',
            metadata={
                'invoice_id': invoice_id,
                'scatterpilot_user_id': owner_user_id,
            },
        )

        logger.info(f"Created public checkout session {session.id} for invoice {invoice_id}")

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
        return error(502, f'Payment provider error. Please try again.')
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return error(500, 'Database error')
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return error(500, 'Failed to create payment session')
