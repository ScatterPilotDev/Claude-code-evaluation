"""
Lambda function: Daily Stats Digest
Scheduled daily at 12:00 UTC (8:00 AM ET) via CloudWatch Events.

Queries ScatterPilot-Subscriptions and ScatterPilot-Invoices tables,
computes key business metrics, then emails a formatted digest to the
configured recipient via SES.

Manual invocation for testing:
  aws lambda invoke \
    --function-name ScatterPilot-DailyDigest-staging \
    --payload '{}' /dev/stdout \
    --region us-east-1
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

sys.path.insert(0, '/opt/python')
from common.logger import get_logger

logger = get_logger("daily_digest")

# ── Environment ───────────────────────────────────────────────────────────────
SUBSCRIPTIONS_TABLE = os.environ.get('SUBSCRIPTIONS_TABLE', 'ScatterPilot-Subscriptions-staging')
INVOICES_TABLE      = os.environ.get('INVOICES_TABLE',      'ScatterPilot-Invoices-staging')
DIGEST_RECIPIENT    = os.environ.get('DIGEST_RECIPIENT',    'ale@scatterpilot.com')
SES_SENDER          = os.environ.get('SES_SENDER',          'ale@scatterpilot.com')

# Monthly prices per plan (for MRR calculation)
PLAN_PRICES_MONTHLY = {
    'solo':   Decimal('29'),
    'pro':    Decimal('49'),
    'agency': Decimal('99'),
}
# Annual prices amortised to monthly
PLAN_PRICES_ANNUAL = {
    'solo':   Decimal('290') / 12,
    'pro':    Decimal('490') / 12,
    'agency': Decimal('990') / 12,
}

dynamodb = boto3.resource('dynamodb')
ses      = boto3.client('ses', region_name='us-east-1')


# =============================================================================
# DynamoDB helpers
# =============================================================================

def _scan_all(table_name: str) -> List[Dict[str, Any]]:
    """Full table scan with pagination. Returns all items or raises on error."""
    table = dynamodb.Table(table_name)
    items: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get('Items', []))
        last = resp.get('LastEvaluatedKey')
        if not last:
            break
        kwargs['ExclusiveStartKey'] = last
    return items


def _safe_float(val: Any) -> float:
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0


def _parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(str(ts).rstrip('Z'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


# =============================================================================
# Subscription stats
# =============================================================================

def compute_subscription_stats(
    now: datetime,
    cutoff_24h: datetime,
    cutoff_48h: datetime,
) -> Dict[str, Any]:
    """
    Scan Subscriptions table and compute user/billing metrics.
    Returns a dict with all subscription-derived stats, or partial data
    with error=True if the scan fails.
    """
    try:
        users = _scan_all(SUBSCRIPTIONS_TABLE)
    except Exception as e:
        logger.error("Failed to scan Subscriptions table", error=e)
        return {'error': True}

    total_users      = len(users)
    new_signups_24h  = 0
    trialing         = 0
    expiring_48h: List[str] = []   # email addresses
    active_by_plan: Dict[str, int] = {}   # plan → count (monthly)
    active_annual_by_plan: Dict[str, int] = {}  # plan → count (annual)
    stripe_connected = 0
    paid_count       = 0
    expired_trial_count = 0

    for u in users:
        status = (u.get('subscription_status') or '').lower()
        plan   = (u.get('subscription_plan')   or '').lower()
        period = (u.get('subscription_period') or 'monthly').lower()
        email  = u.get('email') or u.get('user_email') or ''

        # New signups: users whose trial/account started in the last 24h
        for date_field in ('trial_start_date', 'created_at'):
            ts = _parse_iso(u.get(date_field))
            if ts and ts >= cutoff_24h:
                new_signups_24h += 1
                break

        # Stripe Connect
        if u.get('stripe_connected_account_id'):
            stripe_connected += 1

        if status == 'trialing':
            trialing += 1
            trial_end = _parse_iso(u.get('trial_end_date'))
            if trial_end and cutoff_24h <= trial_end <= cutoff_48h:
                expiring_48h.append(email or u.get('user_id', 'unknown'))

        elif status == 'active':
            paid_count += 1
            target = active_annual_by_plan if period == 'annual' else active_by_plan
            target[plan] = target.get(plan, 0) + 1

        elif status in ('canceled', 'trial_expired'):
            expired_trial_count += 1

    # MRR
    mrr = Decimal('0')
    for plan, count in active_by_plan.items():
        mrr += PLAN_PRICES_MONTHLY.get(plan, Decimal('0')) * count
    for plan, count in active_annual_by_plan.items():
        mrr += PLAN_PRICES_ANNUAL.get(plan, Decimal('0')) * count

    # Trial conversion rate
    denominator = paid_count + expired_trial_count
    conversion_rate = (paid_count / denominator * 100) if denominator > 0 else None

    return {
        'error':               False,
        'total_users':         total_users,
        'new_signups_24h':     new_signups_24h,
        'trialing':            trialing,
        'expiring_48h':        expiring_48h,
        'active_by_plan':      active_by_plan,
        'active_annual_by_plan': active_annual_by_plan,
        'paid_count':          paid_count,
        'stripe_connected':    stripe_connected,
        'mrr':                 float(mrr.quantize(Decimal('0.01'))),
        'conversion_rate':     round(conversion_rate, 1) if conversion_rate is not None else None,
    }


# =============================================================================
# Invoice stats
# =============================================================================

def compute_invoice_stats(
    now: datetime,
    cutoff_24h: datetime,
) -> Dict[str, Any]:
    """
    Scan Invoices table and compute activity metrics.
    """
    try:
        invoices = _scan_all(INVOICES_TABLE)
    except Exception as e:
        logger.error("Failed to scan Invoices table", error=e)
        return {'error': True}

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    created_24h_count   = 0
    created_24h_amount  = Decimal('0')
    created_month_count = 0
    created_month_amount = Decimal('0')
    paid_month_amount   = Decimal('0')
    paid_24h_count      = 0
    paid_24h_amount     = Decimal('0')
    status_counts: Dict[str, int] = {'draft': 0, 'sent': 0, 'paid': 0, 'overdue': 0, 'other': 0}

    for inv in invoices:
        status   = (inv.get('status') or '').lower()
        data     = inv.get('data') or {}
        total    = Decimal(str(data.get('total') or data.get('amount') or '0'))
        due_raw  = data.get('due_date') or ''

        created_at = _parse_iso(inv.get('created_at'))
        updated_at = _parse_iso(inv.get('updated_at'))

        # Status breakdown — classify overdue on the fly
        if status == 'paid':
            status_counts['paid'] += 1
        elif status in ('draft',):
            status_counts['draft'] += 1
        elif status in ('sent', 'pending'):
            due_dt = _parse_iso(due_raw)
            if due_dt and due_dt < now:
                status_counts['overdue'] += 1
            else:
                status_counts['sent'] += 1
        elif status == 'overdue':
            status_counts['overdue'] += 1
        else:
            status_counts['other'] += 1

        # Created in last 24h
        if created_at and created_at >= cutoff_24h:
            created_24h_count  += 1
            created_24h_amount += total

        # Created this month
        if created_at and created_at >= month_start:
            created_month_count  += 1
            created_month_amount += total

        # Payments received in last 24h: paid invoices whose updated_at is recent
        if status == 'paid':
            paid_month_amount += total
            if updated_at and updated_at >= cutoff_24h:
                paid_24h_count  += 1
                paid_24h_amount += total

    def _fmt(d: Decimal) -> str:
        return f"{float(d.quantize(Decimal('0.01'))):,.2f}"

    return {
        'error':                False,
        'created_24h_count':    created_24h_count,
        'created_24h_amount':   _fmt(created_24h_amount),
        'created_month_count':  created_month_count,
        'created_month_amount': _fmt(created_month_amount),
        'paid_24h_count':       paid_24h_count,
        'paid_24h_amount':      _fmt(paid_24h_amount),
        'paid_month_amount':    _fmt(paid_month_amount),
        'status_counts':        status_counts,
    }


# =============================================================================
# Email builders
# =============================================================================

def _plan_row(label: str, monthly: int, annual: int) -> str:
    total = monthly + annual
    suffix = f" ({annual} annual)" if annual else ""
    return f"<tr><td>{label}</td><td style='text-align:right;font-weight:600;'>{total}{suffix}</td></tr>"


def build_html(
    now: datetime,
    sub: Dict[str, Any],
    inv: Dict[str, Any],
) -> str:
    date_str   = now.strftime('%A, %B %-d, %Y')
    NA         = '<em style="color:#8A9484;">n/a</em>'
    UNAVAIL    = '<em style="color:#8A9484;">Data unavailable</em>'

    # ── Revenue block ─────────────────────────────────────────────────────────
    if not sub.get('error'):
        mrr_str       = f"${sub['mrr']:,.2f}"
        paid_str      = str(sub['paid_count'])
        trialing_str  = str(sub['trialing'])
        conv_str      = (f"{sub['conversion_rate']}%" if sub['conversion_rate'] is not None else "—")

        sub_monthly = sub.get('active_by_plan', {})
        sub_annual  = sub.get('active_annual_by_plan', {})
        solo_row    = _plan_row('Solo',   sub_monthly.get('solo',0),   sub_annual.get('solo',0))
        pro_row     = _plan_row('Pro',    sub_monthly.get('pro',0),    sub_annual.get('pro',0))
        agency_row  = _plan_row('Agency', sub_monthly.get('agency',0), sub_annual.get('agency',0))
        trial_row   = f"<tr><td>Trialing</td><td style='text-align:right;font-weight:600;'>{sub['trialing']}</td></tr>"

        new_signups_str    = str(sub['new_signups_24h'])
        stripe_conn_str    = str(sub['stripe_connected'])
    else:
        mrr_str = paid_str = trialing_str = conv_str = "—"
        solo_row = pro_row = agency_row = trial_row = f"<tr><td colspan='2'>{UNAVAIL}</td></tr>"
        new_signups_str = stripe_conn_str = "—"

    # ── Invoice block ─────────────────────────────────────────────────────────
    if not inv.get('error'):
        inv_24h_str    = f"{inv['created_24h_count']} (${inv['created_24h_amount']})"
        pay_24h_str    = f"{inv['paid_24h_count']} (${inv['paid_24h_amount']})"
        month_inv_str  = f"${inv['created_month_amount']}"
        month_sent_str = str(inv['created_month_count'])
        month_pay_str  = f"${inv['paid_month_amount']}"
        sc             = inv['status_counts']
    else:
        inv_24h_str = pay_24h_str = month_inv_str = month_sent_str = month_pay_str = "—"
        sc = {}

    # ── Expiring trials ───────────────────────────────────────────────────────
    expiring = sub.get('expiring_48h', []) if not sub.get('error') else []
    if expiring:
        expiring_block = f"<p style='color:#1A2318;font-size:15px;'>{len(expiring)} trial(s) expiring in the next 48 hours:</p>"
        expiring_block += "<ul style='color:#1A2318;font-size:14px;margin:4px 0 0 0;padding-left:20px;'>"
        for addr in expiring[:10]:   # cap at 10
            expiring_block += f"<li>{addr}</li>"
        if len(expiring) > 10:
            expiring_block += f"<li>…and {len(expiring)-10} more</li>"
        expiring_block += "</ul>"
        action_color = "#C2412D"
    else:
        expiring_block = "<p style='color:#5F6B5A;font-size:15px;'>No trials expiring in the next 48 hours.</p>"
        action_color   = "#4A6741"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2EE;">
<div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:24px auto;padding:24px;background:#FAFBF9;border-radius:8px;border:1px solid #E2E5DE;">

  <h1 style="color:#1A2318;font-size:24px;margin:0 0 4px;">ScatterPilot Daily</h1>
  <p style="color:#5F6B5A;font-size:14px;margin:0 0 16px;">{date_str}</p>

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:0 0 16px;">

  <!-- Revenue -->
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Revenue</h2>
  <p style="font-size:34px;font-weight:700;color:#1A2318;margin:0 0 4px;">{mrr_str}/mo MRR</p>
  <p style="color:#5F6B5A;font-size:14px;margin:0 0 4px;">{paid_str} paid subscribers &middot; {trialing_str} active trials</p>
  <p style="color:#5F6B5A;font-size:14px;margin:0;">Trial→paid conversion: {conv_str}</p>

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">

  <!-- Last 24 hours -->
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Last 24 Hours</h2>
  <table style="width:100%;font-size:15px;color:#1A2318;border-collapse:collapse;">
    <tr><td style="padding:3px 0;">New signups</td><td style="text-align:right;font-weight:600;">{new_signups_str}</td></tr>
    <tr><td style="padding:3px 0;">Invoices created</td><td style="text-align:right;font-weight:600;">{inv_24h_str}</td></tr>
    <tr><td style="padding:3px 0;">Payments received</td><td style="text-align:right;font-weight:600;">{pay_24h_str}</td></tr>
    <tr><td style="padding:3px 0;">Stripe accounts connected</td><td style="text-align:right;font-weight:600;">{stripe_conn_str}</td></tr>
  </table>

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">

  <!-- Subscribers -->
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Subscribers</h2>
  <table style="width:100%;font-size:15px;color:#1A2318;border-collapse:collapse;">
    {solo_row}
    {pro_row}
    {agency_row}
    {trial_row}
  </table>

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">

  <!-- Action needed -->
  <h2 style="color:{action_color};font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Action Needed</h2>
  {expiring_block}

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">

  <!-- This month -->
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">This Month</h2>
  <table style="width:100%;font-size:15px;color:#1A2318;border-collapse:collapse;">
    <tr><td style="padding:3px 0;">Total invoiced</td><td style="text-align:right;font-weight:600;">{month_inv_str}</td></tr>
    <tr><td style="padding:3px 0;">Invoices sent</td><td style="text-align:right;font-weight:600;">{month_sent_str}</td></tr>
    <tr><td style="padding:3px 0;">Payments collected</td><td style="text-align:right;font-weight:600;">{month_pay_str}</td></tr>
  </table>

  <p style="color:#8A9484;font-size:12px;margin:24px 0 0;text-align:center;">
    ScatterPilot Analytics &middot; scatterpilot.com
  </p>
</div>
</body>
</html>"""
    return html


def build_plain(
    now: datetime,
    sub: Dict[str, Any],
    inv: Dict[str, Any],
) -> str:
    date_str = now.strftime('%A, %B %-d, %Y')
    lines = [
        f"ScatterPilot Daily — {date_str}",
        "=" * 40,
        "",
    ]

    if not sub.get('error'):
        sub_monthly = sub.get('active_by_plan', {})
        sub_annual  = sub.get('active_annual_by_plan', {})
        conv        = f"{sub['conversion_rate']}%" if sub['conversion_rate'] is not None else "n/a"
        lines += [
            "REVENUE",
            f"  MRR:               ${sub['mrr']:,.2f}/mo",
            f"  Paid subscribers:  {sub['paid_count']}",
            f"  Active trials:     {sub['trialing']}",
            f"  Conversion rate:   {conv}",
            "",
            "SUBSCRIBERS",
            f"  Solo:    {sub_monthly.get('solo',0) + sub_annual.get('solo',0)}",
            f"  Pro:     {sub_monthly.get('pro',0) + sub_annual.get('pro',0)}",
            f"  Agency:  {sub_monthly.get('agency',0) + sub_annual.get('agency',0)}",
            f"  Trialing: {sub['trialing']}",
            "",
        ]
    else:
        lines += ["REVENUE / SUBSCRIBERS: Data unavailable", ""]

    lines += ["LAST 24 HOURS"]
    lines.append(f"  New signups:              {sub.get('new_signups_24h', '—') if not sub.get('error') else '—'}")

    if not inv.get('error'):
        lines += [
            f"  Invoices created:         {inv['created_24h_count']} (${inv['created_24h_amount']})",
            f"  Payments received:        {inv['paid_24h_count']} (${inv['paid_24h_amount']})",
        ]
    else:
        lines += ["  Invoice data: unavailable"]

    lines.append(f"  Stripe accounts connected: {sub.get('stripe_connected', '—') if not sub.get('error') else '—'}")
    lines.append("")

    expiring = sub.get('expiring_48h', []) if not sub.get('error') else []
    lines += ["ACTION NEEDED"]
    if expiring:
        lines.append(f"  {len(expiring)} trial(s) expiring in next 48 hours:")
        for addr in expiring[:10]:
            lines.append(f"    - {addr}")
        if len(expiring) > 10:
            lines.append(f"    ... and {len(expiring)-10} more")
    else:
        lines.append("  No trials expiring in the next 48 hours.")
    lines.append("")

    if not inv.get('error'):
        lines += [
            "THIS MONTH",
            f"  Total invoiced:       ${inv['created_month_amount']}",
            f"  Invoices sent:        {inv['created_month_count']}",
            f"  Payments collected:   ${inv['paid_month_amount']}",
            "",
        ]
    else:
        lines += ["THIS MONTH: Data unavailable", ""]

    lines.append("ScatterPilot Analytics · scatterpilot.com")
    return "\n".join(lines)


# =============================================================================
# SES delivery
# =============================================================================

def send_digest(subject: str, html_body: str, plain_body: str) -> bool:
    """Send the digest email. Returns True on success, False on failure."""
    try:
        ses.send_email(
            Source=SES_SENDER,
            Destination={'ToAddresses': [DIGEST_RECIPIENT]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': plain_body, 'Charset': 'UTF-8'},
                    'Html':  {'Data': html_body,  'Charset': 'UTF-8'},
                },
            },
        )
        logger.info("Digest email sent", recipient=DIGEST_RECIPIENT)
        return True
    except ClientError as e:
        logger.error("SES send failed", error=e)
        return False
    except Exception as e:
        logger.error("Unexpected SES error", error=e)
        return False


# =============================================================================
# Handler
# =============================================================================

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    CloudWatch scheduled event handler.
    Always returns 200 — individual section failures produce "Data unavailable"
    in the email rather than a Lambda error.
    """
    request_id = getattr(context, 'aws_request_id', 'local')
    logger.set_correlation_id(request_id)
    logger.info("Daily digest started")

    now       = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_48h = now + timedelta(hours=48)

    sub = compute_subscription_stats(now, cutoff_24h, cutoff_48h)
    inv = compute_invoice_stats(now, cutoff_24h)

    date_label = now.strftime('%b %-d, %Y')
    subject    = f"ScatterPilot Daily — {date_label}"
    html_body  = build_html(now, sub, inv)
    plain_body = build_plain(now, sub, inv)

    email_sent = send_digest(subject, html_body, plain_body)

    logger.info(
        "Daily digest complete",
        email_sent=email_sent,
        sub_error=sub.get('error', False),
        inv_error=inv.get('error', False),
        total_users=sub.get('total_users'),
        mrr=sub.get('mrr'),
    )

    return {
        'statusCode': 200,
        'body': {
            'date': date_label,
            'email_sent': email_sent,
            'subscription_data_ok': not sub.get('error', False),
            'invoice_data_ok':      not inv.get('error', False),
        }
    }
