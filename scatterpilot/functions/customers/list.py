"""
Lambda function: List Customers
Aggregates unique customers from invoices and conversations tables
"""

import json
import sys
from typing import Any, Dict
from decimal import Decimal

sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response
)
from common.logger import get_logger

logger = get_logger("list_customers")


def _fetch_all_invoices(db_helper: DynamoDBHelper, user_id: str):
    """Paginate through all invoices for a user."""
    all_invoices = []
    last_key = None
    while True:
        invoices, last_key = db_helper.list_user_invoices(
            user_id=user_id,
            limit=100,
            last_evaluated_key=last_key
        )
        all_invoices.extend(invoices)
        if not last_key:
            break
    return all_invoices


def _fetch_all_conversations(db_helper: DynamoDBHelper, user_id: str):
    """Paginate through all conversations for a user."""
    all_conversations = []
    last_key = None
    while True:
        conversations, last_key = db_helper.list_user_conversations(
            user_id=user_id,
            limit=100,
            last_evaluated_key=last_key
        )
        all_conversations.extend(conversations)
        if not last_key:
            break
    return all_conversations


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for listing unique customers.

    Aggregates customer data from invoices and conversations.
    Returns list of customers with: customer_name, customer_email,
    invoice_count, total_revenue, last_invoice_date, conversation_ids.

    Returns:
        API Gateway response with customers list
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        db_helper = DynamoDBHelper()

        # Build customer map from invoices (primary data source)
        customers = {}
        invoices = _fetch_all_invoices(db_helper, user_id)

        for invoice in invoices:
            name = (invoice.data.customer_name or '').strip()
            if not name:
                continue

            key = name.lower()
            if key not in customers:
                customers[key] = {
                    'customer_name': name,
                    'customer_email': invoice.data.customer_email or '',
                    'invoice_count': 0,
                    'total_revenue': Decimal('0'),
                    'last_invoice_date': None,
                    'conversation_ids': []
                }

            customers[key]['invoice_count'] += 1
            customers[key]['total_revenue'] += invoice.data.total or Decimal('0')

            invoice_date = (
                invoice.data.invoice_date.isoformat()
                if invoice.data.invoice_date else None
            )
            if invoice_date:
                prev = customers[key]['last_invoice_date']
                if prev is None or invoice_date > prev:
                    customers[key]['last_invoice_date'] = invoice_date

            if (
                invoice.conversation_id
                and invoice.conversation_id not in customers[key]['conversation_ids']
            ):
                customers[key]['conversation_ids'].append(invoice.conversation_id)

        # Add customers found in conversations that may not have invoices yet
        conversations = _fetch_all_conversations(db_helper, user_id)
        for conv in conversations:
            if not (conv.extracted_data
                    and conv.extracted_data.get('action') == 'create_invoice'):
                continue

            name = (conv.extracted_data.get('data', {}).get('customer_name') or '').strip()
            if not name:
                continue

            key = name.lower()
            if key not in customers:
                email = conv.extracted_data.get('data', {}).get('customer_email', '')
                customers[key] = {
                    'customer_name': name,
                    'customer_email': email,
                    'invoice_count': 0,
                    'total_revenue': Decimal('0'),
                    'last_invoice_date': None,
                    'conversation_ids': []
                }

            if conv.conversation_id not in customers[key]['conversation_ids']:
                customers[key]['conversation_ids'].append(conv.conversation_id)

        # Serialize and sort (most invoices first, then alphabetically)
        customer_list = [
            {
                'customer_name': c['customer_name'],
                'customer_email': c['customer_email'],
                'invoice_count': c['invoice_count'],
                'total_revenue': str(c['total_revenue']),
                'last_invoice_date': c['last_invoice_date'],
                'conversation_ids': c['conversation_ids']
            }
            for c in customers.values()
        ]
        customer_list.sort(key=lambda x: (-x['invoice_count'], x['customer_name'].lower()))

        logger.info("Customers retrieved", count=len(customer_list))

        return create_success_response({
            'customers': customer_list,
            'count': len(customer_list)
        })

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Failed to retrieve customers", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
