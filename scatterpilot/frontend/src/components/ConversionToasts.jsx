/**
 * ConversionToasts — achievement-based upgrade prompts.
 *
 * Milestones tracked (only shown once, stored in localStorage):
 *   - first_invoice     After first invoice created
 *   - first_payment     After first payment received
 *   - three_clients     After 3+ clients added
 *   - five_k_invoiced   After $5,000+ invoiced
 *
 * Don't show if user already has an active subscription.
 *
 * Usage:
 *   <ConversionToasts
 *     billingStatus={billingStatus}
 *     invoiceCount={allInvoices.length}
 *     totalInvoicedCents={billingStatus?.total_invoiced_amount}
 *     hasReceivedPayment={!!billingStatus?.first_payment_received_at}
 *   />
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LS_KEY = 'sp_conversion_milestones_shown';

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

// ── Individual toast ──────────────────────────────────────────────────────────

function ConversionToast({ message, ctaLabel, onCta, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="flex items-start gap-3 bg-surface-card border border-surface-border rounded-card shadow-lg px-4 py-3 max-w-sm w-full">
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

// ── First-payment modal ───────────────────────────────────────────────────────

function FirstPaymentModal({ onClose, onSeePlans }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-primary/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card rounded-card border border-surface-border shadow-xl w-full max-w-sm p-8 text-center">
        <p className="text-2xl mb-3">💰</p>
        <h2 className="text-heading text-ink-primary mb-1">You just got paid through ScatterPilot!</h2>
        <p className="text-body-sm text-ink-secondary mb-6">Keep the money flowing — choose a plan.</p>
        <button
          onClick={onSeePlans}
          className="w-full py-3 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-semibold text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          See plans
        </button>
        <button onClick={onClose} className="mt-2 w-full text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors py-1">
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConversionToasts({
  billingStatus,
  invoiceCount = 0,
  hasReceivedPayment = false,
  clientCount = 0,
}) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]); // [{ id, message, ctaLabel }]
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const checkedRef = useRef(false);

  const isAlreadySubscribed = billingStatus?.subscription_status === 'active';

  useEffect(() => {
    // Only check once per render cycle (prevent double-firing in StrictMode)
    if (checkedRef.current || isAlreadySubscribed || !billingStatus) return;
    checkedRef.current = true;

    const newToasts = [];

    // First invoice
    if (invoiceCount >= 1 && !wasShown('first_invoice')) {
      markShown('first_invoice');
      newToasts.push({
        id: 'first_invoice',
        message: 'Your first invoice! 🎉 ScatterPilot makes invoicing effortless.',
        ctaLabel: 'Upgrade to keep going →',
      });
    }

    // First payment
    if (hasReceivedPayment && !wasShown('first_payment')) {
      markShown('first_payment');
      setShowPaymentModal(true);
    }

    // 3+ clients
    if (clientCount >= 3 && !wasShown('three_clients')) {
      markShown('three_clients');
      newToasts.push({
        id: 'three_clients',
        message: 'Your client base is growing! Lock in your plan.',
        ctaLabel: 'See plans →',
      });
    }

    // $5,000+ invoiced (backend stores cents)
    const totalCents = billingStatus?.total_invoiced_amount ?? 0;
    if (totalCents >= 500_000 && !wasShown('five_k_invoiced')) {
      markShown('five_k_invoiced');
      newToasts.push({
        id: 'five_k_invoiced',
        message: "You've invoiced over $5,000 with ScatterPilot — it pays for itself.",
        ctaLabel: 'Upgrade →',
      });
    }

    if (newToasts.length > 0) {
      setToasts(prev => [...prev, ...newToasts]);
    }
  }, [billingStatus, invoiceCount, hasReceivedPayment, clientCount, isAlreadySubscribed]);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  const goToPricing = () => navigate('/app/pricing');

  if (isAlreadySubscribed) return null;

  return (
    <>
      {/* Toast stack — bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
          {toasts.map(toast => (
            <ConversionToast
              key={toast.id}
              message={toast.message}
              ctaLabel={toast.ctaLabel}
              onCta={() => { dismissToast(toast.id); goToPricing(); }}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      )}

      {/* First-payment modal */}
      {showPaymentModal && (
        <FirstPaymentModal
          onClose={() => setShowPaymentModal(false)}
          onSeePlans={() => { setShowPaymentModal(false); goToPricing(); }}
        />
      )}
    </>
  );
}
