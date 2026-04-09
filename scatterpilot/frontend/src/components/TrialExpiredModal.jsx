/**
 * TrialExpiredModal — full-screen gate shown when a user with an expired trial
 * tries to create an invoice or access a gated action.
 */

import { useNavigate } from 'react-router-dom';

export default function TrialExpiredModal({ open, onClose }) {
  const navigate = useNavigate();

  if (!open) return null;

  const goToPricing = () => {
    onClose();
    navigate('/app/pricing');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-primary/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-surface-card rounded-card border border-surface-border shadow-xl w-full max-w-md p-8 text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <svg className="h-7 w-7 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2 id="trial-expired-title" className="text-heading text-ink-primary mb-2">
          Your free trial has ended
        </h2>
        <p className="text-body text-ink-secondary mb-2">
          Choose a plan to continue creating invoices and getting paid.
        </p>
        <p className="text-body-sm text-ink-tertiary mb-7">
          You haven't lost anything — all your clients, invoices, and data are safe.
        </p>

        <button
          onClick={goToPricing}
          className="w-full py-3.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-semibold text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          Choose a plan →
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-150 py-1.5 focus-visible:outline-none"
        >
          Continue viewing your existing data
        </button>
      </div>
    </div>
  );
}
