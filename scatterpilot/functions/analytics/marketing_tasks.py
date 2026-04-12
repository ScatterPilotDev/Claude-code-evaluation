"""
Lambda function: Marketing Task Scheduler
Scheduled daily at 11:00 UTC (7:00 AM ET) via CloudWatch Events.

Emails the day's marketing action items — scheduled content, daily
recurring tasks, and the day-of-week weekly task — to the configured
recipient via SES. Runs 1 hour before the stats digest.

No DynamoDB access required — entirely calendar-driven.

Manual invocation for testing:
  aws lambda invoke \
    --function-name ScatterPilot-MarketingTasks-staging \
    --payload '{}' /dev/stdout \
    --region us-east-1
"""

import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

sys.path.insert(0, '/opt/python')
from common.logger import get_logger

logger = get_logger("marketing_tasks")

# ── Environment ───────────────────────────────────────────────────────────────
DIGEST_RECIPIENT = os.environ.get('DIGEST_RECIPIENT', 'ale@scatterpilot.com')
SES_SENDER       = os.environ.get('SES_SENDER',       'ale@scatterpilot.com')

ses = boto3.client('ses', region_name='us-east-1')

# =============================================================================
# Content calendar
# Each entry: (date_str YYYY-MM-DD, description, platform, content_type)
# =============================================================================
CONTENT_CALENDAR: List[Tuple[str, str, str, str]] = [
    ("2026-04-13", "Create and post a screen recording showing invoice creation in 30 seconds", "LinkedIn", "demo"),
    ("2026-04-15", "Post about the invoicing pain point — 30 minutes formatting vs 30 seconds with ScatterPilot", "LinkedIn", "problem"),
    ("2026-04-17", "Feature spotlight: voice invoicing — record yourself dictating an invoice", "LinkedIn", "feature"),
    ("2026-04-18", "Share early tester feedback (ask James for a quote first)", "LinkedIn", "social_proof"),
    ("2026-04-20", "Behind the scenes post — building a SaaS with AI in 2026", "LinkedIn", "building_in_public"),
    ("2026-04-22", "Address the objection: why pay $29 vs using a Word template?", "LinkedIn", "objection"),
    ("2026-04-24", "Post to r/freelance — frame as asking for feedback", "Reddit", "community"),
    ("2026-04-25", "LinkedIn milestone or learning post", "LinkedIn", "milestone"),
    ("2026-04-26", "Launch on Indie Hackers — create product page and launch post", "Indie Hackers", "launch"),
    ("2026-04-27", "Customer story post (even if it's your own experience)", "LinkedIn", "story"),
    ("2026-04-30", "Show HN post — Tuesday morning, be in comments all day", "Hacker News", "launch"),
    ("2026-05-01", "Monthly recap — what worked, what's next", "LinkedIn", "recap"),
]

RECURRING_TASKS: List[str] = [
    "Engage with 3-5 LinkedIn posts from consultants/freelancers (comment thoughtfully, don't pitch)",
    "Check ScatterPilot daily digest — note any new signups to follow up with personally",
    "Review and respond to any product feedback or support emails",
]

# keyed by weekday integer: 0=Monday … 6=Sunday
WEEKLY_TASKS: Dict[int, str] = {
    0: "Monday: Plan this week's 2-3 LinkedIn posts. Draft content.",
    2: "Wednesday: Connect with 5 new consultants/freelancers on LinkedIn.",
    4: "Friday: Update MARKETING.md with this week's metrics. Review what's working.",
}

# Human-readable content type labels
CONTENT_TYPE_LABELS: Dict[str, str] = {
    "demo":             "Demo / Screen Recording",
    "problem":          "Problem Post",
    "feature":          "Feature Spotlight",
    "social_proof":     "Social Proof",
    "building_in_public": "Building in Public",
    "objection":        "Objection Handling",
    "community":        "Community Post",
    "milestone":        "Milestone / Learning",
    "launch":           "Launch Post",
    "story":            "Customer Story",
    "recap":            "Monthly Recap",
}


# =============================================================================
# Lookup helpers
# =============================================================================

def get_todays_content(today_str: str) -> Optional[Tuple[str, str, str, str]]:
    """Return the calendar entry for today, or None."""
    for entry in CONTENT_CALENDAR:
        if entry[0] == today_str:
            return entry
    return None


def get_weekly_task(weekday: int) -> Optional[str]:
    """Return the weekly task for today's weekday, or None."""
    return WEEKLY_TASKS.get(weekday)


# =============================================================================
# Email builders
# =============================================================================

def build_html(
    now: datetime,
    today_str: str,
    scheduled: Optional[Tuple[str, str, str, str]],
) -> str:
    date_str = now.strftime('%A, %B %-d, %Y')
    weekly_task = get_weekly_task(now.weekday())

    # ── Scheduled content block ──────────────────────────────────────────────
    if scheduled:
        _, description, platform, content_type = scheduled
        type_label = CONTENT_TYPE_LABELS.get(content_type, content_type.replace('_', ' ').title())
        scheduled_block = f"""
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Scheduled Content</h2>
  <div style="background:#F4F7F3;border-radius:8px;padding:16px;margin:8px 0;">
    <p style="font-weight:600;color:#1A2318;margin:0 0 4px 0;">{platform} &mdash; {type_label}</p>
    <p style="color:#5F6B5A;margin:0;font-size:15px;">{description}</p>
  </div>"""
    else:
        scheduled_block = """
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Scheduled Content</h2>
  <p style="color:#5F6B5A;font-size:15px;font-style:italic;">No scheduled content today. Consider a spontaneous post about freelancing or getting paid.</p>"""

    # ── Recurring tasks block ────────────────────────────────────────────────
    recurring_items = "\n    ".join(
        f'<li style="margin-bottom:8px;">{task}</li>'
        for task in RECURRING_TASKS
    )

    # ── Weekly task block ────────────────────────────────────────────────────
    if weekly_task:
        weekly_block = f"""
  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">
  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Weekly Task</h2>
  <p style="color:#1A2318;font-size:15px;margin:0;">{weekly_task}</p>"""
    else:
        weekly_block = ""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2EE;">
<div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:24px auto;padding:24px;background:#FAFBF9;border-radius:8px;border:1px solid #E2E5DE;">

  <h1 style="color:#1A2318;font-size:24px;margin:0 0 4px;">Today's Marketing Tasks</h1>
  <p style="color:#5F6B5A;font-size:14px;margin:0 0 16px;">{date_str}</p>

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:0 0 16px;">
  {scheduled_block}

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">

  <h2 style="color:#4A6741;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Daily Tasks</h2>
  <ul style="color:#1A2318;font-size:15px;padding-left:20px;margin:0;">
    {recurring_items}
  </ul>
  {weekly_block}

  <hr style="border:none;border-top:1px solid #E2E5DE;margin:16px 0;">

  <p style="color:#8A9484;font-size:12px;text-align:center;margin:0;">
    Update progress in MARKETING.md when tasks are complete.<br>
    ScatterPilot Marketing &middot; scatterpilot.com
  </p>
</div>
</body>
</html>"""
    return html


def build_plain(
    now: datetime,
    today_str: str,
    scheduled: Optional[Tuple[str, str, str, str]],
) -> str:
    date_str = now.strftime('%A, %B %-d, %Y')
    weekly_task = get_weekly_task(now.weekday())
    lines = [
        f"ScatterPilot Marketing — {date_str}",
        "=" * 40,
        "",
        "SCHEDULED CONTENT",
    ]

    if scheduled:
        _, description, platform, content_type = scheduled
        type_label = CONTENT_TYPE_LABELS.get(content_type, content_type.replace('_', ' ').title())
        lines += [
            f"  Platform:    {platform}",
            f"  Type:        {type_label}",
            f"  Task:        {description}",
        ]
    else:
        lines.append("  No scheduled content today. Consider a spontaneous post about freelancing or getting paid.")

    lines += ["", "DAILY TASKS"]
    for task in RECURRING_TASKS:
        lines.append(f"  • {task}")

    if weekly_task:
        lines += ["", "WEEKLY TASK", f"  {weekly_task}"]

    lines += [
        "",
        "Update progress in MARKETING.md when tasks are complete.",
        "ScatterPilot Marketing · scatterpilot.com",
    ]
    return "\n".join(lines)


# =============================================================================
# SES delivery
# =============================================================================

def send_email(subject: str, html_body: str, plain_body: str) -> bool:
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
        logger.info("Marketing tasks email sent", recipient=DIGEST_RECIPIENT)
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
    Always returns 200 — SES failures are logged but do not crash the Lambda.
    """
    request_id = getattr(context, 'aws_request_id', 'local')
    logger.set_correlation_id(request_id)
    logger.info("Marketing tasks digest started")

    now       = datetime.now(timezone.utc)
    today_str = now.strftime('%Y-%m-%d')

    scheduled   = get_todays_content(today_str)
    weekly_task = get_weekly_task(now.weekday())

    date_label = now.strftime('%b %-d, %Y')
    subject    = f"ScatterPilot Marketing — {date_label} Action Items"
    html_body  = build_html(now, today_str, scheduled)
    plain_body = build_plain(now, today_str, scheduled)

    email_sent = send_email(subject, html_body, plain_body)

    logger.info(
        "Marketing tasks digest complete",
        email_sent=email_sent,
        date=today_str,
        has_scheduled_content=scheduled is not None,
        has_weekly_task=weekly_task is not None,
    )

    return {
        'statusCode': 200,
        'body': {
            'date':                   today_str,
            'email_sent':             email_sent,
            'has_scheduled_content':  scheduled is not None,
            'has_weekly_task':        weekly_task is not None,
        }
    }
