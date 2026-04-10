"""
Lambda function: Reports Summary
GET /reports/summary

Returns aggregated invoice analytics for the authenticated user.
Gated to Pro+ plans (trialing counts as Pro).

Response shape:
{
  "revenueByClient":  [{"client": str, "total": float}, ...],  // top 10, sorted desc
  "monthlyTrend":     [{"month": "YYYY-MM", "invoiced": float, "received": float}, ...],
  "statusBreakdown":  {"draft": int, "sent": int, "paid": int, "overdue": int},
  "agingBuckets":     {"current": int, "1_30": int, "31_60": int, "61_90": int, "90_plus": int},
  "totals":           {"allTime": float, "paid": float, "outstanding": float}
}
"""

import json
import sys
from collections import defaultdict
from datetime import datetime, timezone, date
from typing import Any, Dict, List

sys.path.insert(0, '/opt/python')

from common.access_control import get_user_access
from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import InvoiceStatus
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response,
    InputValidationError,
)
from common.logger import get_logger

logger = get_logger("reports_summary")


def _fetch_all_invoices(db_helper: DynamoDBHelper, user_id: str) -> List:
    """Paginate through all invoices for the user."""
    all_invoices = []
    last_key = None
    while True:
        batch, last_key = db_helper.list_user_invoices(
            user_id=user_id,
            limit=100,
            last_evaluated_key=last_key,
        )
        all_invoices.extend(batch)
        if not last_key:
            break
    return all_invoices


def _safe_float(val) -> float:
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0


def _invoice_month(invoice) -> str:
    """Return 'YYYY-MM' for an invoice's created_at timestamp."""
    try:
        ts = invoice.created_at
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.rstrip('Z'))
        return ts.strftime('%Y-%m')
    except Exception:
        return ''


def _days_overdue(invoice) -> int:
    """Return how many days past due_date the invoice is (0 if not yet due)."""
    try:
        due_raw = invoice.data.to_dynamodb().get('due_date', '')
        if not due_raw:
            return 0
        due_dt = datetime.fromisoformat(due_raw)
        now = datetime.utcnow()
        delta = (now - due_dt).days
        return max(0, delta)
    except Exception:
        return 0


def _compute_reports(invoices: List) -> Dict[str, Any]:
    revenue_by_client: Dict[str, float] = defaultdict(float)
    monthly_invoiced: Dict[str, float] = defaultdict(float)
    monthly_received: Dict[str, float] = defaultdict(float)
    status_counts = {'draft': 0, 'sent': 0, 'paid': 0, 'overdue': 0}
    aging = {'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0}
    total_all = 0.0
    total_paid = 0.0
    total_outstanding = 0.0

    now = datetime.utcnow()

    for inv in invoices:
        data = inv.data.to_dynamodb()
        total = _safe_float(data.get('total'))
        status = str(getattr(inv, 'status', '') or '').lower()
        # Normalise status values
        if hasattr(inv.status, 'value'):
            status = inv.status.value.lower()

        client = (data.get('customer_name') or 'Unknown').strip() or 'Unknown'
        month = _invoice_month(inv)

        total_all += total

        # Revenue by client (all non-draft invoices count)
        if status != 'draft':
            revenue_by_client[client] += total

        # Monthly trend — invoiced on creation, received when paid
        if month:
            monthly_invoiced[month] += total
            if status == 'paid':
                monthly_received[month] += total

        # Status breakdown
        if status == 'paid':
            status_counts['paid'] += 1
            total_paid += total
        elif status == 'draft':
            status_counts['draft'] += 1
        elif status in ('pending', 'sent', 'overdue'):
            # Determine if actually overdue
            days = _days_overdue(inv)
            try:
                due_raw = data.get('due_date', '')
                is_overdue = bool(due_raw) and datetime.fromisoformat(due_raw) < now
            except Exception:
                is_overdue = False
            if is_overdue:
                status_counts['overdue'] += 1
            else:
                status_counts['sent'] += 1
            total_outstanding += total
        else:
            status_counts['sent'] += 1
            total_outstanding += total

        # Aging — only unpaid invoices with a due date
        if status != 'paid' and status != 'draft':
            days = _days_overdue(inv)
            try:
                due_raw = data.get('due_date', '')
                is_past_due = bool(due_raw) and datetime.fromisoformat(due_raw) < now
            except Exception:
                is_past_due = False
            if not is_past_due:
                aging['current'] += 1
            elif days <= 30:
                aging['1_30'] += 1
            elif days <= 60:
                aging['31_60'] += 1
            elif days <= 90:
                aging['61_90'] += 1
            else:
                aging['90_plus'] += 1

    # Top 10 clients by revenue
    top_clients = sorted(
        [{'client': k, 'total': round(v, 2)} for k, v in revenue_by_client.items()],
        key=lambda x: x['total'],
        reverse=True,
    )[:10]

    # Last 12 months sorted
    all_months = sorted(set(list(monthly_invoiced.keys()) + list(monthly_received.keys())))[-12:]
    monthly_trend = [
        {
            'month': m,
            'invoiced': round(monthly_invoiced.get(m, 0.0), 2),
            'received': round(monthly_received.get(m, 0.0), 2),
        }
        for m in all_months
    ]

    return {
        'revenueByClient': top_clients,
        'monthlyTrend': monthly_trend,
        'statusBreakdown': status_counts,
        'agingBuckets': aging,
        'totals': {
            'allTime': round(total_all, 2),
            'paid': round(total_paid, 2),
            'outstanding': round(total_outstanding, 2),
        },
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else 'local'
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        db_helper = DynamoDBHelper()

        # Plan gate — Pro+ only
        subscription = db_helper.get_user_subscription(user_id)
        access = get_user_access(subscription or {})
        plan = (subscription or {}).get('subscription_plan')
        status = (subscription or {}).get('subscription_status')

        # Trialing users get Pro access; check plan for active subscribers
        has_reports_access = (
            status == 'trialing'
            or (access['hasAccess'] and plan in ('pro', 'agency'))
        )

        if not has_reports_access:
            return create_error_response(
                403,
                'Reports are available on Pro and Agency plans. Upgrade to access full analytics.',
                'PlanRestricted',
            )

        invoices = _fetch_all_invoices(db_helper, user_id)
        report_data = _compute_reports(invoices)

        logger.info('Reports computed', invoice_count=len(invoices))
        return create_success_response(report_data)

    except InputValidationError as e:
        return create_error_response(400, str(e), 'ValidationError')
    except DynamoDBException as e:
        logger.error('Database error', error=e)
        return create_error_response(500, 'Database error occurred', 'DatabaseError')
    except Exception as e:
        logger.error('Unexpected error', error=e)
        return create_error_response(500, 'An unexpected error occurred', 'InternalError')
