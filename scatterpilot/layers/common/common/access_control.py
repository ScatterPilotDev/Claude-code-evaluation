"""
Access control helper — determines what a user can do based on subscription/trial status.

Used by both Lambda functions (access gating) and can be mirrored in the frontend.
"""

import math
from datetime import datetime
from typing import Any, Dict, Optional


def get_user_access(user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Determine a user's access level from their subscription/trial record.

    Args:
        user: DynamoDB subscription/profile record (any dict with subscription fields).

    Returns:
        {
            hasAccess: bool,
            plan: 'solo' | 'pro' | 'agency' | None,
            reason: 'active' | 'trialing' | 'trial_expired' | 'past_due' | 'canceled' | 'none',
            daysRemaining: int | None,   # only present when trialing
        }
    """
    now = datetime.utcnow()
    status = user.get('subscription_status') or 'none'

    # ── Active subscriber ────────────────────────────────────────────────────
    if status == 'active':
        return {
            'hasAccess': True,
            'plan': user.get('subscription_plan'),
            'reason': 'active',
        }

    # ── Trialing ─────────────────────────────────────────────────────────────
    if status == 'trialing':
        trial_end_str = user.get('trial_end_date')
        if trial_end_str:
            try:
                trial_end = datetime.fromisoformat(trial_end_str.rstrip('Z'))
                if now < trial_end:
                    delta = trial_end - now
                    days_remaining = math.ceil(delta.total_seconds() / 86400)
                    return {
                        'hasAccess': True,
                        'plan': 'pro',          # trial gives full Pro access
                        'reason': 'trialing',
                        'daysRemaining': days_remaining,
                    }
            except (ValueError, AttributeError):
                pass
        # No valid trial_end_date or trial has passed
        return {'hasAccess': False, 'plan': None, 'reason': 'trial_expired'}

    # ── Past due — 3-day grace period while Stripe retries ───────────────────
    if status == 'past_due':
        return {
            'hasAccess': True,
            'plan': user.get('subscription_plan'),
            'reason': 'past_due',
        }

    # ── Canceled — access until end of billing period (Stripe governs cutoff) ─
    if status == 'canceled':
        return {
            'hasAccess': True,
            'plan': user.get('subscription_plan'),
            'reason': 'canceled',
        }

    # ── Everything else (free, expired, none) ────────────────────────────────
    return {'hasAccess': False, 'plan': None, 'reason': status}


def is_trial_expired(user: Dict[str, Any]) -> bool:
    """Convenience: returns True when a trialing user's trial window has closed."""
    trial_end_str = user.get('trial_end_date')
    if not trial_end_str:
        return True
    try:
        trial_end = datetime.fromisoformat(trial_end_str.rstrip('Z'))
        return datetime.utcnow() >= trial_end
    except (ValueError, AttributeError):
        return True


def trial_days_remaining(user: Dict[str, Any]) -> int:
    """Returns whole days left in the trial (0 if expired or no trial)."""
    trial_end_str = user.get('trial_end_date')
    if not trial_end_str:
        return 0
    try:
        trial_end = datetime.fromisoformat(trial_end_str.rstrip('Z'))
        delta = trial_end - datetime.utcnow()
        return max(0, math.ceil(delta.total_seconds() / 86400))
    except (ValueError, AttributeError):
        return 0
