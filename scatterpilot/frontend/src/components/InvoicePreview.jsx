import { useState, useEffect } from 'react';
import api from '../services/api';
import analytics from '../utils/analytics';

// Recompute line item totals and invoice subtotal/tax/total from raw fields
function computeDerivedTotals(data) {
  const lineItems = (data.line_items || []).map(item => ({
    ...item,
    total: (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)
  }));
  const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.total), 0);
  const taxRate = parseFloat(data.tax_rate || 0);
  const taxAmount = subtotal * taxRate;
  const discount = parseFloat(data.discount || 0);
  const total = subtotal + taxAmount - discount;
  return {
    ...data,
    line_items: lineItems,
    subtotal: subtotal.toFixed(2),
    tax_amount: taxAmount.toFixed(2),
    total: total.toFixed(2)
  };
}

export default function InvoicePreview({ invoiceId, invoiceData, onNewInvoice, subscription }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // displayData is the committed (saved/original) data shown in view mode
  const [displayData, setDisplayData] = useState(invoiceData);
  // editData is the working copy during edit mode
  const [editData, setEditData] = useState(null);

  // When a new invoice is loaded, reset all edit state
  useEffect(() => {
    setDisplayData(invoiceData);
    setIsEditing(false);
    setEditData(null);
    setSaveError(null);
  }, [invoiceId]);

  const activeData = isEditing ? editData : displayData;

  const startEdit = () => {
    setEditData(computeDerivedTotals(JSON.parse(JSON.stringify(displayData))));
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditData(null);
    setSaveError(null);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const computed = computeDerivedTotals(editData);
      await api.updateInvoice(invoiceId, computed);
      setDisplayData(computed);
      setIsEditing(false);
      setEditData(null);
    } catch (error) {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (idx, field, value) => {
    setEditData(prev => {
      const items = [...prev.line_items];
      items[idx] = { ...items[idx], [field]: value };
      return computeDerivedTotals({ ...prev, line_items: items });
    });
  };

  const addLineItem = () => {
    setEditData(prev => computeDerivedTotals({
      ...prev,
      line_items: [
        ...prev.line_items,
        { description: '', quantity: '1', unit_price: '0.00', taxable: true, total: '0.00' }
      ]
    }));
  };

  const removeLineItem = (idx) => {
    setEditData(prev => computeDerivedTotals({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== idx)
    }));
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await api.generatePdf(invoiceId);
      if (response.status === 'completed' || response.download_url) {
        analytics.trackInvoiceDownloaded(invoiceId, 'PDF');
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

  if (!invoiceId || !invoiceData) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg border-2 border-dashed border-gray-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-700">No invoice yet</h3>
          <p className="mt-1 text-sm text-gray-500">Start chatting to generate an invoice</p>
        </div>
      </div>
    );
  }

  const {
    customer_name, customer_email, customer_address,
    invoice_date, due_date, line_items = [],
    subtotal, tax_rate, tax_amount, total, notes
  } = activeData;

  const inputCls = 'w-full px-2 py-1 border border-gray-300 rounded text-navy focus:outline-none focus:ring-1 focus:ring-sage text-sm';

  return (
    <div className="h-full bg-white rounded-lg shadow-xl border border-gray-200 overflow-y-auto">
      <div className="p-8">

        {/* Header */}
        <div className="border-b-2 border-sage pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-navy mb-2">INVOICE</h1>
              <p className="text-sm text-navy-muted">ID: {invoiceId}</p>
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-sm text-navy-muted mb-1">Invoice Date</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={invoice_date || ''}
                    onChange={e => updateField('invoice_date', e.target.value)}
                    className={inputCls}
                  />
                ) : (
                  <p className="font-semibold text-navy">{formatDate(invoice_date)}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-navy-muted mt-1 mb-1">Due Date</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={due_date || ''}
                    onChange={e => updateField('due_date', e.target.value)}
                    className={inputCls}
                  />
                ) : (
                  <p className="font-semibold text-navy">{formatDate(due_date)}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-8 bg-cream-light p-4 rounded-lg border border-gray-200">
          <h2 className="text-xs font-bold text-navy-muted uppercase tracking-wide mb-3">Bill To</h2>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={customer_name || ''}
                onChange={e => updateField('customer_name', e.target.value)}
                placeholder="Customer name"
                className={`${inputCls} text-base font-bold`}
              />
              <input
                type="email"
                value={customer_email || ''}
                onChange={e => updateField('customer_email', e.target.value)}
                placeholder="Email (optional)"
                className={inputCls}
              />
              <textarea
                value={customer_address || ''}
                onChange={e => updateField('customer_address', e.target.value)}
                placeholder="Address (optional)"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          ) : (
            <>
              <p className="text-xl font-bold text-navy">{customer_name}</p>
              {customer_email && <p className="text-navy-light mt-1">{customer_email}</p>}
              {customer_address && <p className="text-navy-light mt-1">{customer_address}</p>}
            </>
          )}
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Description</th>
                <th className="text-center py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Qty</th>
                <th className="text-right py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Unit Price</th>
                <th className="text-right py-3 text-xs font-bold text-navy-muted uppercase tracking-wide">Amount</th>
                {isEditing && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {line_items.map((item, idx) => (
                <tr key={idx} className="hover:bg-cream-light transition-colors">
                  <td className="py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={e => updateLineItem(idx, 'description', e.target.value)}
                        className={inputCls}
                      />
                    ) : (
                      <p className="font-medium text-navy">{item.description}</p>
                    )}
                  </td>
                  <td className="text-center py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                        className={`${inputCls} text-center w-20`}
                      />
                    ) : (
                      <span className="text-navy-light">{item.quantity}</span>
                    )}
                  </td>
                  <td className="text-right py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unit_price}
                        onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                        className={`${inputCls} text-right w-28`}
                      />
                    ) : (
                      <span className="text-navy-light">{formatCurrency(parseFloat(item.unit_price))}</span>
                    )}
                  </td>
                  <td className="text-right py-3 font-semibold text-navy">
                    {formatCurrency(parseFloat(item.total))}
                  </td>
                  {isEditing && (
                    <td className="pl-2 py-3">
                      <button
                        onClick={() => removeLineItem(idx)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Remove line"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {isEditing && (
            <button
              onClick={addLineItem}
              className="mt-3 flex items-center space-x-1 text-sm text-sage hover:text-sage-dark font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add line item</span>
            </button>
          )}
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            <div className="flex justify-between py-3 border-t border-gray-200">
              <span className="text-navy-light">Subtotal</span>
              <span className="font-semibold text-navy">{formatCurrency(parseFloat(subtotal))}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-t border-gray-200">
              <span className="text-navy-light">
                Tax ({isEditing ? (
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={tax_rate}
                    onChange={e => updateField('tax_rate', e.target.value)}
                    className="inline w-16 px-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-sage"
                  />
                ) : (
                  (parseFloat(tax_rate) * 100).toFixed(2)
                )}%)
              </span>
              <span className="font-semibold text-navy">{formatCurrency(parseFloat(tax_amount))}</span>
            </div>
            <div className="flex justify-between py-4 border-t-2 border-sage bg-sage-light px-4 rounded-lg mt-2">
              <span className="font-bold text-lg text-navy">Total</span>
              <span className="font-bold text-2xl text-sage">{formatCurrency(parseFloat(total))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(notes || isEditing) && (
          <div className="mb-8 p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Notes</p>
            {isEditing ? (
              <textarea
                value={notes || ''}
                onChange={e => updateField('notes', e.target.value)}
                placeholder="Additional notes (optional)"
                rows={3}
                className="w-full px-2 py-1 border border-amber-300 rounded text-sm text-amber-900 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
              />
            ) : (
              <p className="text-sm text-amber-900">{notes}</p>
            )}
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          {/* Edit / Save / Cancel */}
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={saveEdit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-sage hover:bg-sage-dark text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-navy-light hover:text-navy hover:border-gray-400 font-medium rounded-lg transition-all duration-200 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                className="px-4 py-2 border border-gray-300 text-navy-light hover:text-navy hover:border-sage font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Invoice</span>
              </button>
            )}
          </div>

          {/* Download PDF — always visible */}
          <button
            className="px-6 py-3 bg-sage hover:bg-sage-dark text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
