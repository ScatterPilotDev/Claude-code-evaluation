"""
Lambda function: Get Public Invoice Data
GET /invoices/{invoice_id}/public

Returns invoice data for the public payment page — no auth required.
This is what clients see when they receive an invoice link.

Returns only public-safe fields. Does NOT return: user_id, internal IDs,
email addresses stored on the user's account, or sensitive metadata.

If the invoice is already paid, paymentReady is false (no payment button shown).
"""

import json
import os
import sys

sys.path.insert(0, '/opt/python')

import boto3
from botocore.exceptions import ClientError

from common.access_control import get_user_access
from common.logger import get_logger

logger = get_logger("get_public_invoice")

INVOICES_TABLE = os.environ['INVOICES_TABLE']
SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']

dynamodb = boto3.resource('dynamodb')
invoices_table = dynamodb.Table(INVOICES_TABLE)
subscriptions_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

        logger.info(f"Public invoice request for {invoice_id}")

        # ── Fetch invoice ──────────────────────────────────────────────────────
        inv_resp = invoices_table.get_item(Key={'invoice_id': invoice_id})
        invoice = inv_resp.get('Item')

        if not invoice:
            return error(404, 'Invoice not found')

        data = invoice.get('data', {})
        invoice_status = invoice.get('status', 'draft')

        # ── Fetch owner's profile & subscription ──────────────────────────────
        business_name = None
        show_branding = True  # default: show subtle branding
        user_id = invoice.get('user_id')
        if user_id:
            try:
                sub_resp = subscriptions_table.get_item(
                    Key={'user_id': user_id},
                    ProjectionExpression='business_name, subscription_plan, subscription_status',
                )
                owner_sub = sub_resp.get('Item', {})
                business_name = owner_sub.get('business_name')
                # Pro & Agency active subscribers: no branding on public page
                plan = owner_sub.get('subscription_plan')
                status = owner_sub.get('subscription_status')
                show_branding = not (
                    plan in ('pro', 'agency')
                    and status in ('active', 'past_due', 'canceled')
                )
            except ClientError:
                pass  # Non-fatal — invoice still shown without business name

        # ── Build safe public payload ──────────────────────────────────────────
        line_items = data.get('line_items', [])
        public_line_items = [
            {
                'description': li.get('description', ''),
                'quantity': li.get('quantity', '1'),
                'unit_price': li.get('unit_price', '0'),
                'total': li.get('total', '0'),
            }
            for li in line_items
        ]

        paid = invoice_status == 'paid'

        payload = {
            'invoiceId': invoice_id,
            'invoiceNumber': data.get('invoice_number'),
            'businessName': business_name,
            'customerName': data.get('customer_name'),
            'customerEmail': data.get('customer_email'),
            'invoiceDate': data.get('invoice_date'),
            'dueDate': data.get('due_date'),
            'lineItems': public_line_items,
            'subtotal': data.get('subtotal'),
            'taxRate': data.get('tax_rate'),
            'taxAmount': data.get('tax_amount'),
            'total': data.get('total'),
            'notes': data.get('notes'),
            'status': invoice_status,
            'paid': paid,
            'paidAt': invoice.get('paid_at') if paid else None,
            # paymentReady = user has a connected account and invoice is payable
            'paymentReady': bool(
                not paid
                and invoice_status not in ('cancelled',)
            ),
            'showBranding': show_branding,
        }

        logger.info(f"Returning public invoice {invoice_id}, status={invoice_status}")

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(payload),
        }

    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return error(500, 'Database error')
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return error(500, 'Failed to fetch invoice')
