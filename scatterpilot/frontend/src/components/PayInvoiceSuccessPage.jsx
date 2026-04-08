/**
 * Invoice payment success page — /pay/:invoiceId/success
 *
 * Shown after Stripe redirects the client back following a successful payment.
 * Standalone page — no auth, no sidebar.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

function IconCheckCircle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export default function PayInvoiceSuccessPage() {
  useEffect(() => {
    document.title = 'Payment Received — ScatterPilot';
  }, []);

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center">
            <IconCheckCircle className="w-8 h-8 text-success-600" />
          </div>
        </div>

        <h1 className="text-title text-ink-primary mb-3">Payment received!</h1>
        <p className="text-body text-ink-secondary mb-2">
          Thank you for your payment.
        </p>
        <p className="text-body-sm text-ink-tertiary mb-8">
          A receipt has been sent to your email by Stripe.
        </p>

        <Link
          to="/"
          className="text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-150 underline underline-offset-2"
        >
          Return to ScatterPilot
        </Link>
      </div>

      <p className="absolute bottom-6 text-label text-ink-tertiary">
        Powered by{' '}
        <Link to="/" className="hover:text-ink-secondary transition-colors duration-150">
          ScatterPilot
        </Link>
      </p>
    </div>
  );
}
