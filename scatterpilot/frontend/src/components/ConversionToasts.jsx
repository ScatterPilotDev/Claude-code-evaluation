/**
 * ConversionToasts — achievement-based upgrade prompts.
 *
 * Reads conversion_milestones from billingStatus (backend source of truth).
 * Each milestone is shown at most once per browser, tracked in localStorage.
 *
 * Milestones:
 *   first_invoice  → toast
 *   first_payment  → UpgradeModal
 *   three_clients  → toast
 *   invoiced_5k    → toast
 *
 * Not shown when user already has an active subscription.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LS_KEY = 'sp_shown_milestones';

function getShown() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function markShown(milestone) {
  const shown = getShown();
  if (!shown.includes(milestone)) {
    localStorage.setItem(LS_KEY, JSON.stringify([...shown, milestone]));
  }
}

function wasShown(milestone) {
  return getShown().includes(milestone);
}

// ── Toast component ───────────────────────────────────────────────────────────

function ConversionToast({ message, ctaLabel, onCta, onDismiss, visible }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={[
        'flex items-start gap-3 bg-surface-card border border-surface-border rounded-card shadow-dropdown',
        'px-4 py-3 max-w-sm w-full',
        'transition-all duration-300 ease-out',
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0',
      ].join(' ')}
    >
      <p className="flex-1 text-body-sm text-ink-primary">{message}</p>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <button
          onClick={onCta}
          className="text-body-sm text-sage-600 font-semibold hover:text-sage-700 whitespace-nowrap focus-visible:outline-none"
        >
          {ctaLabel}
        </button>
        <button
          onClick={onDismiss}
          className="text-ink-tertiary hover:text-ink-secondary focus-visible:outline-none"
          aria-label="Dismiss"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Upgrade modal (first_payment) ─────────────────────────────────────────────

function UpgradeModal({ onClose, onSeePlans }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface-card rounded-card border border-surface-border shadow-xl w-full max-w-sm p-8 text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-4">
          <svg className="h-7 w-7 text-sage-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l2 2" />
            <path d="M8.5 16.5 A6 6 0 1 1 15.5 16.5" />
          </svg>
        </div>
        <h2 className="text-heading text-ink-primary mb-1">You just got paid through ScatterPilot!</h2>
        <p className="text-body-sm text-ink-secondary mb-6">
          Keep the money flowing — choose a plan that grows with you.
        </p>
        <button
          onClick={onSeePlans}
          className="w-full py-3 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-semibold text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          See plans
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors py-1"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MILESTONE_CONFIGS = {
  first_invoice: {
    type: 'toast',
    message: 'Your first invoice! ScatterPilot makes invoicing effortless.',
    ctaLabel: 'Upgrade to keep going →',
  },
  three_clients: {
    type: 'toast',
    message: 'Your client base is growing! Lock in your plan before the trial ends.',
    ctaLabel: 'See plans →',
  },
  invoiced_5k: {
    type: 'toast',
    message: "You've invoiced over $5,000 with ScatterPilot — it pays for itself.",
    ctaLabel: 'Upgrade →',
  },
  first_payment: {
    type: 'modal',
  },
};

// Order in which milestones are processed (first_invoice always first)
const MILESTONE_ORDER = ['first_invoice', 'first_payment', 'three_clients', 'invoiced_5k'];

export default function ConversionToasts({ billingStatus }) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]); // [{ id, message, ctaLabel, visible }]
  const [showModal, setShowModal] = useState(false);
  const checkedRef = useRef(false);

  const isAlreadySubscribed = billingStatus?.subscription_status === 'active';

  useEffect(() => {
    if (checkedRef.current || isAlreadySubscribed || !billingStatus) return;
    checkedRef.current = true;

    const backendMilestones = billingStatus.conversion_milestones || [];
    const newToasts = [];

    for (const milestone of MILESTONE_ORDER) {
      if (!backendMilestones.includes(milestone)) continue;
      if (wasShown(milestone)) continue;

      markShown(milestone);
      const config = MILESTONE_CONFIGS[milestone];
      if (!config) continue;

      if (config.type === 'modal') {
        setShowModal(true);
      } else {
        newToasts.push({
          id: milestone,
          message: config.message,
          ctaLabel: config.ctaLabel,
          visible: false,
        });
      }
    }

    if (newToasts.length > 0) {
      setToasts(prev => [...prev, ...newToasts]);
      // Trigger slide-in on next frame
      requestAnimationFrame(() => {
        setToasts(prev => prev.map(t =>
          newToasts.some(nt => nt.id === t.id) ? { ...t, visible: true } : t
        ));
      });
    }
  }, [billingStatus, isAlreadySubscribed]);

  const dismissToast = (id) => {
    // Slide out first, then remove
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  };

  const goToPricing = () => navigate('/app/pricing');

  if (isAlreadySubscribed) return null;

  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end pointer-events-none">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ConversionToast
                message={toast.message}
                ctaLabel={toast.ctaLabel}
                visible={toast.visible}
                onCta={() => { dismissToast(toast.id); goToPricing(); }}
                onDismiss={() => dismissToast(toast.id)}
              />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <UpgradeModal
          onClose={() => setShowModal(false)}
          onSeePlans={() => { setShowModal(false); goToPricing(); }}
        />
      )}
    </>
  );
}
