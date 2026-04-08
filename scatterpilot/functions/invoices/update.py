"""
Lambda function: Update Invoice
Updates invoice status and/or content fields
"""

import json
import sys
from typing import Any, Dict
from datetime import datetime

sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import InvoiceStatus
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response
)
from common.logger import get_logger

logger = get_logger("update_invoice")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for updating an invoice.

    Accepts:
      { "status": "paid" }                    — status-only update
      { "customer_name": ..., "line_items": ... } — full data update
      { "status": "paid", "customer_name": ...}   — combined

    Path parameter: invoice_id
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        invoice_id = (event.get('pathParameters') or {}).get('invoice_id')
        if not invoice_id:
            return create_error_response(400, "Invoice ID required", "ValidationError")

        body = json.loads(event.get('body') or '{}')

        db_helper = DynamoDBHelper()
        invoice = db_helper.get_invoice(invoice_id)
        if not invoice or invoice.user_id != user_id:
            return create_error_response(404, "Invoice not found", "NotFound")

        # Status update
        if 'status' in body:
            try:
                new_status = InvoiceStatus(body['status'].lower())
                db_helper.update_invoice_status(invoice_id, new_status)
                logger.info("Invoice status updated", invoice_id=invoice_id, status=new_status.value)
            except ValueError:
                return create_error_response(
                    400,
                    f"Invalid status '{body['status']}'. Valid values: draft, sent, paid, overdue",
                    "ValidationError"
                )

        # Full data update — triggered by InvoicePreview edit flow
        data_keys = {'customer_name', 'customer_email', 'customer_address',
                     'invoice_date', 'due_date', 'line_items', 'tax_rate', 'discount', 'notes'}
        if data_keys.intersection(body):
            from decimal import Decimal
            from datetime import date
            from common.models import InvoiceData, LineItem

            try:
                raw_items = body.get('line_items')
                if raw_items is not None:
                    line_items = [
                        LineItem(
                            description=item['description'],
                            quantity=Decimal(str(item['quantity'])),
                            unit_price=Decimal(str(item['unit_price'])),
                            taxable=bool(item.get('taxable', True))
                        )
                        for item in raw_items
                    ]
                else:
                    line_items = invoice.data.line_items

                invoice_date_val = (
                    date.fromisoformat(body['invoice_date'])
                    if 'invoice_date' in body else invoice.data.invoice_date
                )
                due_date_val = (
                    date.fromisoformat(body['due_date'])
                    if 'due_date' in body else invoice.data.due_date
                )

                updated_data = InvoiceData(
                    customer_name=body.get('customer_name', invoice.data.customer_name),
                    customer_email=body.get('customer_email', invoice.data.customer_email),
                    customer_address=body.get('customer_address', invoice.data.customer_address),
                    invoice_date=invoice_date_val,
                    due_date=due_date_val,
                    line_items=line_items,
                    tax_rate=Decimal(str(body.get('tax_rate', str(invoice.data.tax_rate)))),
                    discount=Decimal(str(body.get('discount', str(invoice.data.discount)))),
                    notes=body.get('notes', invoice.data.notes)
                )
                invoice.data = updated_data
                invoice.updated_at = datetime.utcnow()
                # put_item acts as upsert — preserves invoice_id / user_id / status
                db_helper.create_invoice(invoice)
                logger.info("Invoice data updated", invoice_id=invoice_id)

            except (KeyError, ValueError) as e:
                logger.error("Invalid invoice data", error=e)
                return create_error_response(400, f"Invalid invoice data: {str(e)}", "ValidationError")

        return create_success_response({
            'invoice_id': invoice_id,
            'message': 'Invoice updated successfully'
        })

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
