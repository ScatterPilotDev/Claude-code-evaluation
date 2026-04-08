import { useState, useEffect } from 'react';
import { ArrowLeftIcon, PlusIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

const STATUS_COLORS = {
  paid:      'bg-green-100 text-green-700 border border-green-200',
  sent:      'bg-blue-100  text-blue-700  border border-blue-200',
  overdue:   'bg-red-100   text-red-700   border border-red-200',
  draft:     'bg-gray-100  text-gray-600  border border-gray-200',
  pending:   'bg-amber-100 text-amber-700 border border-amber-200',
  cancelled: 'bg-gray-100  text-gray-500  border border-gray-200',
};

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-navy-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

export default function CustomerProfile({ customerName, onNewInvoice, onBack }) {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editable profile fields (phone / notes stored separately)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [savedNotes, setSavedNotes] = useState('');

  useEffect(() => {
    if (customerName) fetchInvoices();
  }, [customerName]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listInvoices();
      const filtered = (res.invoices || [])
        .filter(inv =>
          (inv.customer_name || '').toLowerCase() === customerName.toLowerCase()
        )
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setInvoices(filtered);
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.updateCustomer(customerName, { phone, notes });
      setSavedPhone(phone);
      setSavedNotes(notes);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save customer profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPhone(savedPhone);
    setNotes(savedNotes);
    setIsEditing(false);
  };

  // Derive stats from invoices
  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
  const avgInvoice = invoices.length > 0 ? totalRevenue / invoices.length : 0;
  const mostRecentInvoice = invoices[0];
  const customerEmail = mostRecentInvoice?.customer_email || '';

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sage focus:border-sage';

  return (
    <div className="h-full overflow-y-auto bg-cream">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Back button + Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-navy-muted hover:text-navy transition-all"
                title="Back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-navy">{customerName}</h1>
              {customerEmail && (
                <p className="text-navy-light mt-0.5">{customerEmail}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onNewInvoice && onNewInvoice(customerName, customerEmail)}
            className="flex items-center gap-2 px-5 py-2.5 bg-sage hover:bg-sage-dark text-white font-medium rounded-lg shadow-sm transition-all duration-200"
          >
            <PlusIcon className="h-4 w-4" />
            New Invoice
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
          <StatCard label="Invoices" value={invoices.length} />
          <StatCard label="Avg Invoice" value={formatCurrency(avgInvoice)} />
        </div>

        {/* Contact Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Contact Info</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-sm text-navy-muted hover:text-navy transition-colors"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 text-sm text-sage hover:text-sage-dark font-medium transition-colors disabled:opacity-50"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 text-sm text-navy-muted hover:text-navy transition-colors"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="px-6 py-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-navy-muted mb-1">Email</p>
              <p className="text-sm text-navy">{customerEmail || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-navy-muted mb-1">Phone</p>
              {isEditing ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Add phone number"
                  className={inputCls}
                />
              ) : (
                <p className="text-sm text-navy">{savedPhone || '—'}</p>
              )}
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-navy-muted mb-1">Notes</p>
              {isEditing ? (
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes about this customer"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              ) : (
                <p className="text-sm text-navy whitespace-pre-wrap">{savedNotes || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Invoice History Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Invoice History</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-sage" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={fetchInvoices} className="mt-2 text-sm text-sage hover:underline">Retry</button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-navy-muted">No invoices yet for this customer.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-navy-muted uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-navy-muted uppercase tracking-wider">Invoice ID</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-navy-muted uppercase tracking-wider">Amount</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-navy-muted uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => (
                  <tr key={inv.invoice_id} className="hover:bg-cream transition-colors">
                    <td className="px-6 py-4 text-sm text-navy-light">{formatDate(inv.invoice_date || inv.created_at)}</td>
                    <td className="px-6 py-4 text-sm font-mono text-navy-muted truncate max-w-[160px]">
                      {inv.invoice_id.split('-')[0]}…
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-navy text-right">
                      {formatCurrency(parseFloat(inv.total || 0))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[inv.status?.toLowerCase()] || STATUS_COLORS.draft}`}>
                        {inv.status || 'draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
