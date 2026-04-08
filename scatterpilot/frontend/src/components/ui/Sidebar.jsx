import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import {
  DocumentTextIcon as DocumentTextIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
} from '@heroicons/react/24/solid';
import authService from '../../services/auth';
import api from '../../services/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import ConversationList from '../ConversationList';
import CustomerSection from '../CustomerSection';

const shouldShowPaymentBadge = () =>
  !localStorage.getItem('scatterpilot_payment_badge_dismissed');

// Shared section collapse animation
const collapseVariants = {
  open:   { height: 'auto', opacity: 1 },
  closed: { height: 0,      opacity: 0 },
};

// Section header — same typography, spacing, and chevron for every section
function SectionHeader({ title, expanded, onToggle, count, onAdd, addLabel }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-3 py-2.5 group hover:bg-cream rounded-lg transition-colors duration-150"
    >
      <div className="flex items-center gap-2">
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-navy-muted transition-transform duration-200 ${
            expanded ? 'rotate-0' : '-rotate-90'
          }`}
        />
        <span className="text-xs font-semibold text-navy-muted uppercase tracking-wider">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs text-navy-muted bg-gray-100 px-1.5 py-0.5 rounded-full leading-none">
            {count}
          </span>
        )}
      </div>
      {onAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          title={addLabel || 'Add'}
          className="p-0.5 rounded text-navy-muted hover:text-navy hover:bg-gray-200 transition-colors duration-150"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </button>
  );
}

export default function Sidebar({
  onNewInvoice,
  userEmail = '',
  userName = '',
  userInitials = '',
  onNavigate,
  onInvoiceClick,
  selectedInvoiceId,
  refreshInvoiceList,
  onConversationSelect,
  onConversationDelete,
  activeConversationId,
  onNewConversation,
  refreshConversationList,
  onCustomerNewInvoice,
  onCustomerClick
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openFeedback } = useFeedback();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceError, setInvoiceError] = useState(null);
  const [showPaymentBadge, setShowPaymentBadge] = useState(shouldShowPaymentBadge());

  // All sections expanded by default
  const [navExpanded, setNavExpanded] = useState(true);
  const [customersExpanded, setCustomersExpanded] = useState(true);
  const [conversationsExpanded, setConversationsExpanded] = useState(true);
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);

  useEffect(() => {
    const checkBadgeStatus = () => setShowPaymentBadge(shouldShowPaymentBadge());
    window.addEventListener('focus', checkBadgeStatus);
    const interval = setInterval(checkBadgeStatus, 1000);
    return () => {
      window.removeEventListener('focus', checkBadgeStatus);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [refreshInvoiceList]);

  const loadInvoices = async () => {
    setIsLoadingInvoices(true);
    setInvoiceError(null);
    try {
      const response = await api.listInvoices();
      const sorted = (response.invoices || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setInvoices(sorted);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setInvoiceError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/');
  };

  const handleNavClick = (href) => {
    if (onNavigate) onNavigate();
    navigate(href);
  };

  const handleInvoiceClick = (invoiceId, customerName) => {
    if (onInvoiceClick) onInvoiceClick(invoiceId, customerName);
    if (onNavigate) onNavigate();
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const truncate = (text, max) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  };

  const getStatusColor = (status) => {
    const map = {
      paid:      'bg-green-100 text-green-700 border border-green-200',
      sent:      'bg-blue-100  text-blue-700  border border-blue-200',
      overdue:   'bg-red-100   text-red-700   border border-red-200',
      draft:     'bg-gray-100  text-gray-600  border border-gray-200',
      pending:   'bg-amber-100 text-amber-700 border border-amber-200',
      cancelled: 'bg-gray-100  text-gray-500  border border-gray-200',
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  };

  const navigation = [
    {
      name: 'Invoices',
      href: '/app',
      icon: DocumentTextIcon,
      iconSolid: DocumentTextIconSolid,
      current: location.pathname === '/app',
    },
    {
      name: 'Account',
      href: '/account',
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
      current: location.pathname === '/account',
    },
    {
      name: 'Feedback',
      href: null, // opens modal
      icon: ChatBubbleLeftRightIcon,
      iconSolid: ChatBubbleLeftRightIconSolid,
      current: false,
    },
  ];

  // Shared item class builder
  const itemCls = (active) =>
    `flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-sage text-white shadow-sm'
        : 'text-navy-light hover:bg-cream hover:text-navy'
    }`;

  const selectedInvoiceCls = (id) =>
    `w-full text-left px-3 py-3 rounded-lg transition-all duration-200 ${
      selectedInvoiceId === id
        ? 'bg-sage-light border border-sage/30 shadow-sm'
        : 'hover:bg-cream border border-transparent'
    }`;

  return (
    <div className="flex h-full w-80 flex-col bg-white border-r border-gray-200 shadow-sm">

      {/* ── Logo & New Invoice ─────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 border-b border-gray-200">
        <Link to="/app" className="flex items-center gap-2 px-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-navy">ScatterPilot</span>
        </Link>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewInvoice}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sage hover:bg-sage-dark text-white rounded-lg font-medium shadow-sm transition-all duration-200"
          aria-label="Create new invoice"
        >
          <PlusIcon className="h-4 w-4" />
          <span>New Invoice</span>
        </motion.button>
      </div>

      {/* ── Scrollable sections ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">

        {/* ── Navigation ──────────────────────────────────── */}
        <div className="mb-1">
          <SectionHeader
            title="Navigation"
            expanded={navExpanded}
            onToggle={() => setNavExpanded(v => !v)}
          />
          <AnimatePresence initial={false}>
            {navExpanded && (
              <motion.div
                key="nav-content"
                variants={collapseVariants}
                initial="closed"
                animate="open"
                exit="closed"
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pb-2 space-y-0.5">
                  {navigation.map((item) => {
                    const Icon = item.current ? item.iconSolid : item.icon;
                    if (item.name === 'Feedback') {
                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            openFeedback();
                            if (onNavigate) onNavigate();
                          }}
                          className={itemCls(false)}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.name}</span>
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={itemCls(item.current)}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.name}</span>
                        {item.name === 'Account' && showPaymentBadge && (
                          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white animate-pulse">
                            NEW
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* divider */}
        <div className="border-t border-gray-100 my-1" />

        {/* ── Customers ────────────────────────────────────── */}
        {onConversationSelect && (
          <>
            <div className="mb-1">
              <SectionHeader
                title="Customers"
                expanded={customersExpanded}
                onToggle={() => setCustomersExpanded(v => !v)}
              />
              <AnimatePresence initial={false}>
                {customersExpanded && (
                  <motion.div
                    key="customers-content"
                    variants={collapseVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="pb-2">
                      <CustomerSection
                        onConversationSelect={onConversationSelect}
                        activeConversationId={activeConversationId}
                        onCustomerNewInvoice={onCustomerNewInvoice}
                        onCustomerClick={onCustomerClick}
                        refreshTrigger={refreshConversationList}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* divider */}
            <div className="border-t border-gray-100 my-1" />
          </>
        )}

        {/* ── Conversations ────────────────────────────────── */}
        {onConversationSelect && (
          <>
            <div className="mb-1">
              <SectionHeader
                title="Conversations"
                expanded={conversationsExpanded}
                onToggle={() => setConversationsExpanded(v => !v)}
                onAdd={onNewConversation}
                addLabel="New conversation"
              />
              <AnimatePresence initial={false}>
                {conversationsExpanded && (
                  <motion.div
                    key="conv-content"
                    variants={collapseVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="pb-2">
                      <ConversationList
                        onConversationSelect={onConversationSelect}
                        onConversationDelete={onConversationDelete}
                        activeConversationId={activeConversationId}
                        refreshTrigger={refreshConversationList}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* divider */}
            <div className="border-t border-gray-100 my-1" />
          </>
        )}

        {/* ── Invoice History ──────────────────────────────── */}
        <div className="mb-1">
          <SectionHeader
            title="Invoice History"
            expanded={invoicesExpanded}
            onToggle={() => setInvoicesExpanded(v => !v)}
            count={invoices.length || undefined}
          />
          <AnimatePresence initial={false}>
            {invoicesExpanded && (
              <motion.div
                key="invoices-content"
                variants={collapseVariants}
                initial="closed"
                animate="open"
                exit="closed"
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pb-2">
                  {isLoadingInvoices ? (
                    <div className="space-y-1 px-1 py-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="px-3 py-3 animate-pulse">
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="h-3 w-28 bg-gray-200 rounded" />
                            <div className="h-4 w-12 bg-gray-100 rounded-full" />
                          </div>
                          <div className="flex justify-between">
                            <div className="h-3 w-16 bg-gray-200 rounded" />
                            <div className="h-3 w-14 bg-gray-100 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : invoiceError ? (
                    <div className="px-3 py-2">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs text-red-700 mb-1">{invoiceError}</p>
                        <button onClick={loadInvoices} className="text-xs text-red-600 hover:text-red-700 font-medium underline">
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
                      <p className="text-xs text-navy-muted">Your invoices will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {invoices.map((invoice) => (
                        <button
                          key={invoice.invoice_id}
                          onClick={() => handleInvoiceClick(
                            invoice.invoice_id,
                            invoice.customer_name || invoice.invoice_data?.billTo?.company || invoice.invoice_data?.billTo?.name
                          )}
                          className={selectedInvoiceCls(invoice.invoice_id)}
                        >
                          {/* Customer + status */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-navy truncate">
                              {truncate(invoice.customer_name || invoice.invoice_data?.billTo?.company || invoice.invoice_data?.billTo?.name || 'Unknown', 22)}
                            </span>
                            {invoice.status && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${getStatusColor(invoice.status)}`}>
                                {invoice.status}
                              </span>
                            )}
                          </div>
                          {/* Amount + date */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-sage">
                              {formatCurrency(parseFloat(invoice.total || invoice.invoice_data?.total || 0))}
                            </span>
                            <span className="text-navy-muted">
                              {formatDate(invoice.created_at)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* ── User profile footer ────────────────────────────── */}
      <div className="border-t border-gray-200 p-2">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-cream transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sage flex-shrink-0">
              <span className="text-sm font-semibold text-white">
                {userInitials || (userEmail ? userEmail[0].toUpperCase() : 'U')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy truncate">{userName || userEmail || 'User'}</p>
              <p className="text-xs text-navy-muted">View profile</p>
            </div>
            <ChevronDownIcon
              className={`h-4 w-4 text-navy-muted transition-transform duration-200 ${
                userMenuOpen ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
              >
                <Link
                  to="/account"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-navy-light hover:bg-cream transition-colors"
                >
                  <Cog6ToothIcon className="h-5 w-5" />
                  <span>Account Settings</span>
                </Link>
                <button
                  onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-cream transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
