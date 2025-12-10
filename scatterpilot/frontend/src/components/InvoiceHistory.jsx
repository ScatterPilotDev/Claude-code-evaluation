import { useState, useEffect } from 'react';
import api from '../services/api';

export default function InvoiceHistory({
  onInvoiceSelect,
  selectedInvoiceId,
  onNewInvoice,
  refreshTrigger
}) {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Fetch invoice list
  useEffect(() => {
    fetchInvoices();
  }, [refreshTrigger]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listInvoices();
      console.log('[SIDEBAR] Received invoices response:', response);

      // Sort by created_at descending (newest first)
      const sortedInvoices = (response.invoices || []).sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      console.log('[SIDEBAR] Sorted invoices:', sortedInvoices);
      if (sortedInvoices.length > 0) {
        console.log('[SIDEBAR] Sample invoice structure:', sortedInvoices[0]);
      }

      setInvoices(sortedInvoices);
    } catch (err) {
      console.error('[SIDEBAR] Failed to fetch invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvoiceClick = (invoice) => {
    onInvoiceSelect(invoice);
    // Close mobile sidebar after selection
    setIsMobileOpen(false);
  };

  const handleNewInvoiceClick = () => {
    onNewInvoice();
    setIsMobileOpen(false);
  };

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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Truncate text
  const truncate = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusColors = {
      'paid': 'bg-green-900/30 text-green-400 border border-green-700/50',
      'pending': 'bg-amber-900/30 text-amber-400 border border-amber-700/50',
      'overdue': 'bg-red-900/30 text-red-400 border border-red-700/50',
      'draft': 'bg-gray-100 text-gray-600 border border-gray-200'
    };
    return statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-600 border border-gray-200';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Invoice History</h2>
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Invoice Button */}
        <button
          onClick={handleNewInvoiceClick}
          className="w-full px-4 py-3 bg-gradient-brand hover:bg-gradient-brand-hover text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-glow-purple"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Invoice</span>
        </button>
      </div>

      {/* Invoice List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin h-8 w-8 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-4">
              <p className="text-sm text-red-300 mb-2">{error}</p>
              <button
                onClick={fetchInvoices}
                className="text-sm text-red-400 hover:text-red-300 font-medium underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
            <svg
              className="w-16 h-16 text-slate-600 mb-4"
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
            <h3 className="text-lg font-medium text-gray-700 mb-1">No invoices yet</h3>
            <p className="text-sm text-gray-700">Create your first invoice to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {invoices.map((invoice) => (
              <button
                key={invoice.invoice_id}
                onClick={() => handleInvoiceClick(invoice)}
                className={`w-full text-left p-4 hover:bg-gray-100/50 transition-all duration-200 ${
                  selectedInvoiceId === invoice.invoice_id
                    ? 'bg-purple-900/20 border-l-4 border-purple-500 shadow-glow-purple/10'
                    : 'border-l-4 border-transparent'
                }`}
              >
                <div className="space-y-2">
                  {/* Invoice Number */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500">
                      {truncate(invoice.invoice_id, 20)}
                    </span>
                    {invoice.status && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    )}
                  </div>

                  {/* Customer Name */}
                  <div className="font-semibold text-gray-900">
                    {truncate(invoice.customer_name || 'Unknown Customer', 30)}
                  </div>

                  {/* Amount and Date */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold bg-gradient-brand bg-clip-text text-transparent">
                      {formatCurrency(parseFloat(invoice.total) || 0)}
                    </span>
                    <span className="text-gray-600">
                      {formatDate(invoice.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-20 left-4 z-40 p-3 bg-gray-100 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-200 transition-colors"
      >
        <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-70 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: always visible, Mobile: slides in when open */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <SidebarContent />
      </div>
    </>
  );
}
