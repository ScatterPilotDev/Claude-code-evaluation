/**
 * TrialBanner — shown above page content during a free trial.
 *
 * Days 1-7:   silent (no banner)
 * Days 8-10:  soft nudge, dismissable
 * Days 11-12: amber urgency, not dismissable
 * Days 13-14: red final push, not dismissable
 * Expired:    persistent "trial ended" bar
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DISMISS_KEY = 'sp_trial_banner_dismissed_';

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function TrialBanner({ billingStatus }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!billingStatus) return null;

  const { subscription_status, trial_days_remaining: days, access } = billingStatus;
  const isExpired = access?.reason === 'trial_expired';

  useEffect(() => {
    // Check if banner was dismissed today (for the soft nudge tier)
    const key = DISMISS_KEY + today();
    if (localStorage.getItem(key) === '1') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY + today(), '1');
    setDismissed(true);
  };

  const goToPricing = () => navigate('/app/pricing');

  // ── Expired (no active subscription) ────────────────────────────────────
  if (isExpired || subscription_status === 'expired') {
    return (
      <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 bg-danger-50 border border-danger-200 rounded-card text-danger-700">
        <span className="text-body-sm font-medium">
          Your free trial has ended.
        </span>
        <button
          onClick={goToPricing}
          className="flex-shrink-0 text-body-sm font-semibold underline underline-offset-2 hover:text-danger-800 transition-colors focus-visible:outline-none"
        >
          Choose a plan →
        </button>
      </div>
    );
  }

  if (subscription_status !== 'trialing' || days === null) return null;

  // ── Days 1-7: silent ─────────────────────────────────────────────────────
  if (days > 10) return null;

  // ── Days 8-10: soft nudge, dismissable ──────────────────────────────────
  if (days > 7 && days <= 10) {
    if (dismissed) return null;
    return (
      <div className="mb-6 flex items-center justify-between gap-4 px-4 py-2.5 bg-surface-muted border border-surface-border rounded-card">
        <span className="text-body-sm text-ink-secondary">
          🕐 {days} day{days === 1 ? '' : 's'} left in your Pro trial.
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={goToPricing}
            className="text-body-sm text-sage-600 font-medium hover:text-sage-700 transition-colors focus-visible:outline-none"
          >
            See plans →
          </button>
          <button
            onClick={handleDismiss}
            className="text-ink-tertiary hover:text-ink-secondary transition-colors focus-visible:outline-none"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Days 11-12: amber urgency ────────────────────────────────────────────
  if (days >= 2 && days <= 5) {
    return (
      <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-card">
        <span className="text-body-sm text-amber-800 font-medium">
          ⚠ Your trial ends in {days} day{days === 1 ? '' : 's'}. Keep your invoicing running.
        </span>
        <button
          onClick={goToPricing}
          className="flex-shrink-0 text-body-sm text-amber-700 font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors focus-visible:outline-none"
        >
          Choose a plan →
        </button>
      </div>
    );
  }

  // ── Days 13-14 (days === 1 or days === 0): final push ───────────────────
  return (
    <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 bg-danger-50 border border-danger-200 rounded-card">
      <span className="text-body-sm text-danger-700 font-medium">
        🔥 Your trial ends {days === 0 ? 'today' : 'tomorrow'}! Subscribe now to keep invoicing.
      </span>
      <button
        onClick={goToPricing}
        className="flex-shrink-0 text-body-sm text-danger-700 font-semibold underline underline-offset-2 hover:text-danger-900 transition-colors focus-visible:outline-none"
      >
        Choose a plan →
      </button>
    </div>
  );
}
