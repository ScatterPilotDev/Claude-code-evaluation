/**
 * Public invoice payment page — /pay/:invoiceId
 *
 * No auth required.
 * - Loads invoice data via GET /invoices/:invoiceId/public (no auth)
 * - "Pay" button calls POST /invoices/:invoiceId/public-checkout (no auth),
 *   which creates a Stripe Checkout Session and returns the redirect URL.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

// ── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    parseFloat(amount || 0)
  );
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function InvoiceSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-surface-muted rounded mx-auto" />
      <div className="h-5 w-32 bg-surface-muted rounded mx-auto" />
      <div className="h-px bg-surface-border" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between">
            <div className="h-4 w-48 bg-surface-muted rounded" />
            <div className="h-4 w-20 bg-surface-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-12 w-full bg-surface-muted rounded-button" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PayInvoicePage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  useEffect(() => {
    document.title = 'Invoice Payment — ScatterPilot';
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicInvoice(invoiceId);
      setInvoice(data);
      if (data.businessName) {
        document.title = `Invoice from ${data.businessName} — ScatterPilot`;
      }
    } catch (err) {
      setError('This invoice could not be found or is no longer available.');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const { paymentUrl } = await api.createPublicCheckout(invoiceId);
      window.location.href = paymentUrl;
    } catch (err) {
      setPayError(err.message || 'Could not start payment. Please try again.');
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      <main className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-2xl">

          {loading && (
            <div className="bg-surface-card border border-surface-border rounded-card p-8">
              <InvoiceSkeleton />
            </div>
          )}

          {!loading && error && (
            <div className="bg-surface-card border border-surface-border rounded-card p-8 text-center">
              <p className="text-body text-ink-secondary">{error}</p>
            </div>
          )}

          {!loading && invoice && (
            <div className="bg-surface-card border border-surface-border rounded-card overflow-hidden">
              {/* Header */}
              <div className="px-8 pt-8 pb-6 border-b border-surface-border">
                {invoice.businessName && (
                  <p className="text-label uppercase tracking-widest text-ink-tertiary font-medium mb-1">
                    {invoice.businessName}
                  </p>
                )}
                <h1 className="text-title text-ink-primary">
                  {invoice.invoiceNumber ? `Invoice #${invoice.invoiceNumber}` : 'Invoice'}
                </h1>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-ink-secondary">
                  {invoice.invoiceDate && (
                    <span>Issued: {formatDate(invoice.invoiceDate)}</span>
                  )}
                  {invoice.dueDate && (
                    <span>Due: {formatDate(invoice.dueDate)}</span>
                  )}
                </div>

                {/* Paid badge */}
                {invoice.paid && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-50 border border-success-200 text-success-700 text-label font-medium">
                    <IconCheck className="h-3.5 w-3.5" />
                    Paid {invoice.paidAt ? `on ${formatDate(invoice.paidAt)}` : ''}
                  </div>
                )}
              </div>

              <div className="px-8 py-6">
                {/* Bill to */}
                {(invoice.customerName || invoice.customerEmail) && (
                  <div className="mb-6">
                    <p className="text-label uppercase tracking-widest text-ink-tertiary font-medium mb-1">
                      Bill to
                    </p>
                    {invoice.customerName && (
                      <p className="text-body font-medium text-ink-primary">{invoice.customerName}</p>
                    )}
                    {invoice.customerEmail && (
                      <p className="text-body-sm text-ink-secondary">{invoice.customerEmail}</p>
                    )}
                  </div>
                )}

                {/* Line items table */}
                <div className="mb-6 rounded-lg border border-surface-border overflow-hidden">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="bg-surface-muted border-b border-surface-border">
                        <th className="text-left px-4 py-3 text-ink-tertiary font-medium uppercase tracking-wide text-label">Description</th>
                        <th className="text-center px-4 py-3 text-ink-tertiary font-medium uppercase tracking-wide text-label">Qty</th>
                        <th className="text-right px-4 py-3 text-ink-tertiary font-medium uppercase tracking-wide text-label">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {(invoice.lineItems || []).map((item, i) => (
                        <tr key={i} className="bg-surface-card">
                          <td className="px-4 py-3 text-ink-primary">{item.description || '—'}</td>
                          <td className="px-4 py-3 text-center text-ink-secondary">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-medium text-ink-primary">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {invoice.subtotal && invoice.taxAmount && parseFloat(invoice.taxAmount) > 0 && (
                        <>
                          <tr className="border-t border-surface-border bg-surface-muted">
                            <td colSpan={2} className="px-4 py-2 text-right text-ink-secondary">Subtotal</td>
                            <td className="px-4 py-2 text-right text-ink-secondary">{formatCurrency(invoice.subtotal)}</td>
                          </tr>
                          <tr className="bg-surface-muted">
                            <td colSpan={2} className="px-4 py-2 text-right text-ink-secondary">
                              Tax ({(parseFloat(invoice.taxRate || 0) * 100).toFixed(0)}%)
                            </td>
                            <td className="px-4 py-2 text-right text-ink-secondary">{formatCurrency(invoice.taxAmount)}</td>
                          </tr>
                        </>
                      )}
                      <tr className="border-t-2 border-surface-border bg-surface-muted">
                        <td colSpan={2} className="px-4 py-3 text-right font-semibold text-ink-primary text-body">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-ink-primary text-heading">
                          {formatCurrency(invoice.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Notes */}
                {invoice.notes && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-body-sm text-amber-900">{invoice.notes}</p>
                  </div>
                )}

                {/* Pay button or paid state */}
                {invoice.paymentReady && !invoice.paid && (
                  <div className="mt-2">
                    {payError && (
                      <p className="mb-3 text-body-sm text-danger-600">{payError}</p>
                    )}
                    <button
                      onClick={handlePay}
                      disabled={paying}
                      className="w-full py-4 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse text-heading font-semibold rounded-button transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 flex items-center justify-center gap-3"
                    >
                      {paying ? (
                        <>
                          <span className="inline-block w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                          Redirecting to payment…
                        </>
                      ) : (
                        `Pay ${formatCurrency(invoice.total)}`
                      )}
                    </button>
                    <p className="mt-2 text-center text-body-sm text-ink-tertiary">
                      Secure payment powered by Stripe
                    </p>
                  </div>
                )}

                {invoice.paid && (
                  <div className="mt-2 py-4 flex items-center justify-center gap-2 rounded-button bg-success-50 border border-success-200 text-success-700 font-medium text-body">
                    <IconCheck className="h-5 w-5" />
                    This invoice has been paid
                  </div>
                )}

                {!invoice.paymentReady && !invoice.paid && (
                  <div className="mt-2 py-4 text-center text-body-sm text-ink-tertiary">
                    Online payment is not available for this invoice. Please contact the sender.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="mt-6 text-center text-label text-ink-tertiary">
            Powered by{' '}
            <Link to="/" className="hover:text-ink-secondary transition-colors duration-150">
              ScatterPilot
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
