import { useState } from 'react';
import api from '../services/api';
import analytics from '../utils/analytics';

export default function InvoicePreview({ invoiceId, invoiceData, onNewInvoice, subscription }) {
  const [isDownloading, setIsDownloading] = useState(false);

  console.log('[PREVIEW] Rendering - invoiceId:', invoiceId, 'has invoiceData:', !!invoiceData);

  if (!invoiceId || !invoiceData) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg border-2 border-dashed border-gray-200">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-700">No invoice yet</h3>
          <p className="mt-1 text-sm text-gray-500">Start chatting to generate an invoice</p>
        </div>
      </div>
    );
  }

  // Use invoiceData directly
  const data = invoiceData;
  const invoice_id = invoiceId;

  const {
    customer_name,
    customer_email,
    customer_address,
    invoice_date,
    due_date,
    line_items = [],
    subtotal,
    tax_rate,
    tax_amount,
    total,
    notes
  } = data;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      // First, generate the PDF (creates PDF and uploads to S3)
      const response = await api.generatePdf(invoice_id);

      if (response.status === 'completed' || response.download_url) {
        // Track PDF download
        analytics.trackInvoiceDownloaded(invoice_id, 'PDF');

        // Open PDF in same tab to avoid pop-up blockers (especially on mobile)
        window.location.href = response.download_url;
      } else {
        throw new Error('PDF generation failed');
      }
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-full bg-white rounded-lg shadow-xl border border-gray-200 overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="border-b-2 border-sage pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-navy mb-2">INVOICE</h1>
              <p className="text-sm text-navy-muted">ID: {invoice_id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-navy-muted mb-1">Invoice Date</p>
              <p className="font-semibold text-navy">{formatDate(invoice_date)}</p>
              <p className="text-sm text-navy-muted mt-3 mb-1">Due Date</p>
              <p className="font-semibold text-navy">{formatDate(due_date)}</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-8 bg-cream-light p-4 rounded-lg border border-gray-200">
          <h2 className="text-xs font-bold text-navy-muted uppercase tracking-wide mb-3">Bill To</h2>
          <p className="text-xl font-bold text-navy">{customer_name}</p>
          {customer_email && <p className="text-navy-light mt-1">{customer_email}</p>}
          {customer_address && <p className="text-navy-light mt-1">{customer_address}</p>}
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Description</th>
                <th className="text-center py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Qty</th>
                <th className="text-right py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Unit Price</th>
                <th className="text-right py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {line_items.map((item, idx) => (
                <tr key={idx} className="hover:bg-cream-light transition-colors">
                  <td className="py-4">
                    <p className="font-medium text-navy">{item.description}</p>
                  </td>
                  <td className="text-center py-4 text-navy-light">{item.quantity}</td>
                  <td className="text-right py-4 text-navy-light">{formatCurrency(parseFloat(item.unit_price))}</td>
                  <td className="text-right py-4 font-semibold text-navy">{formatCurrency(parseFloat(item.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            {/* Subtotal */}
            <div className="flex justify-between py-3 border-t border-gray-200">
              <span className="text-navy-light">Subtotal</span>
              <span className="font-semibold text-navy">{formatCurrency(parseFloat(subtotal))}</span>
            </div>

            {/* Tax */}
            <div className="flex justify-between py-3 border-t border-gray-200">
              <span className="text-navy-light">Tax ({(parseFloat(tax_rate) * 100).toFixed(2)}%)</span>
              <span className="font-semibold text-navy">{formatCurrency(parseFloat(tax_amount))}</span>
            </div>

            {/* Total */}
            <div className="flex justify-between py-4 border-t-2 border-sage bg-sage-light px-4 rounded-lg mt-2">
              <span className="font-bold text-lg text-navy">Total</span>
              <span className="font-bold text-2xl text-sage">{formatCurrency(parseFloat(total))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="mb-8 p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-amber-900">{notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end items-center pt-6 border-t border-gray-200">
          <button
            className="px-6 py-3 bg-sage hover:bg-sage-dark text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
