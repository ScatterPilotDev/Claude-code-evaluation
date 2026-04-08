import { useState, useEffect } from 'react';
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import authService from '../services/auth';

export default function CustomerSection({
  onConversationSelect,
  activeConversationId,
  onCustomerNewInvoice,
  onCustomerClick,
  refreshTrigger
}) {
  const [customers, setCustomers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [refreshTrigger]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const authenticated = await authService.isAuthenticated();
      if (!authenticated) {
        setIsLoading(false);
        return;
      }
      const [customersRes, convsRes] = await Promise.all([
        api.listCustomers(),
        api.listConversations()
      ]);
      setCustomers(customersRes.customers || []);
      setConversations(convsRes.conversations || []);
    } catch (err) {
      console.error('[CUSTOMERS] Failed to fetch:', err);
      const msg = (err?.message || '').toLowerCase();
      const isAuth =
        msg.includes('not authenticated') ||
        msg.includes('authentication required') ||
        msg.includes('session expired');
      if (!isAuth) setError(err.message || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCustomer = (customerName) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerName)) next.delete(customerName);
      else next.add(customerName);
      return next;
    });
  };

  const getConversationsForCustomer = (customerName) =>
    conversations
      .filter(c => c.customer_name &&
        c.customer_name.toLowerCase() === customerName.toLowerCase())
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    try { return formatDistanceToNow(new Date(dateString), { addSuffix: true }); }
    catch { return ''; }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
      .format(parseFloat(amount || 0));

  const truncate = (text, max) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  };

  const getConversationTitle = (conv) => {
    if (!conv.message_count || conv.state === 'initiated') return 'New conversation';
    if (conv.first_user_message) return truncate(conv.first_user_message, 35);
    return 'Invoice conversation';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16">
        <svg className="animate-spin h-5 w-5 text-sage" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700 mb-1">{error}</p>
          <button onClick={fetchData} className="text-xs text-red-600 hover:text-red-700 font-medium underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
        <svg className="w-8 h-8 text-navy-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-xs text-navy-muted">No customers yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {customers.map(customer => {
        const isExpanded = expandedCustomers.has(customer.customer_name);
        const customerConvs = getConversationsForCustomer(customer.customer_name);

        return (
          <div key={customer.customer_name}>
            {/* Customer row */}
            <div className="flex items-center gap-1 group">
              <button
                onClick={() => toggleCustomer(customer.customer_name)}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-cream transition-all duration-200 text-left min-w-0 group/row"
              >
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 text-navy-muted transition-transform duration-200 flex-shrink-0 ${
                    isExpanded ? 'rotate-0' : '-rotate-90'
                  }`}
                />
                {/* Avatar */}
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sage/15 flex-shrink-0">
                  <span className="text-[10px] font-bold text-sage">
                    {customer.customer_name[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Clickable customer name opens profile */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => {
                      e.stopPropagation();
                      onCustomerClick && onCustomerClick(customer);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        onCustomerClick && onCustomerClick(customer);
                      }
                    }}
                    className="text-sm font-medium text-navy truncate leading-snug hover:text-sage hover:underline cursor-pointer block"
                  >
                    {customer.customer_name}
                  </span>
                  <p className="text-[11px] text-navy-muted leading-snug">
                    {customer.invoice_count} invoice{customer.invoice_count !== 1 ? 's' : ''}
                    {parseFloat(customer.total_revenue) > 0
                      ? ` · ${formatCurrency(customer.total_revenue)}`
                      : ''}
                  </p>
                </div>
              </button>

              {/* New Invoice button (visible on hover) */}
              <button
                onClick={() => onCustomerNewInvoice && onCustomerNewInvoice(
                  customer.customer_name,
                  customer.customer_email
                )}
                title={`New invoice for ${customer.customer_name}`}
                className="p-1.5 mr-1 rounded text-navy-muted hover:text-sage hover:bg-cream opacity-0 group-hover:opacity-100 transition-all duration-150 flex-shrink-0"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Expanded conversations */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="ml-6 pl-3 border-l border-gray-200 space-y-0.5 pb-1 mt-0.5">
                    {customerConvs.length === 0 ? (
                      <p className="text-[11px] text-navy-muted px-3 py-2 italic">
                        No conversations yet
                      </p>
                    ) : (
                      customerConvs.map(conv => {
                        const isActive = activeConversationId === conv.conversation_id;
                        return (
                          <button
                            key={conv.conversation_id}
                            onClick={() => onConversationSelect && onConversationSelect(conv)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                              isActive
                                ? 'bg-sage-light text-navy border border-sage/30'
                                : 'text-navy-light hover:bg-cream hover:text-navy'
                            }`}
                          >
                            <p className="text-xs font-medium text-navy truncate leading-snug">
                              {getConversationTitle(conv)}
                            </p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-navy-muted">
                                {conv.message_count || 0} msg
                              </span>
                              <span className="text-[10px] text-navy-muted">
                                {formatRelativeTime(conv.updated_at)}
                              </span>
                            </div>
                            {isActive && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-sage font-medium">
                                <div className="w-1.5 h-1.5 bg-sage rounded-full animate-pulse" />
                                Active
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
