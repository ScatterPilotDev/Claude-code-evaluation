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
} from '@heroicons/react/24/outline';
import {
  DocumentTextIcon as DocumentTextIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
} from '@heroicons/react/24/solid';
import authService from '../../services/auth';
import api from '../../services/api';
import { useFeedback } from '../../contexts/FeedbackContext';

export default function Sidebar({
  onNewInvoice,
  userEmail = '',
  userName = '',
  userInitials = '',
  onNavigate,
  onInvoiceClick,
  selectedInvoiceId,
  refreshInvoiceList
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openFeedback } = useFeedback();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceError, setInvoiceError] = useState(null);

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/');
  };

  const handleNavClick = (href) => {
    if (onNavigate) onNavigate(); // Close mobile menu
    navigate(href);
  };

  const navigation = [
    {
      name: 'Invoices',
      href: '/app',
      icon: DocumentTextIcon,
      iconSolid: DocumentTextIconSolid,
      current: location.pathname === '/app'
    },
    {
      name: 'Account',
      href: '/account',
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
      current: location.pathname === '/account'
    },
    {
      name: 'Feedback',
      href: '/feedback',
      icon: ChatBubbleLeftRightIcon,
      iconSolid: ChatBubbleLeftRightIconSolid,
      current: location.pathname === '/feedback'
    },
  ];

  // Load invoices
  useEffect(() => {
    loadInvoices();
  }, [refreshInvoiceList]);

  const loadInvoices = async () => {
    setIsLoadingInvoices(true);
    setInvoiceError(null);
    try {
      const response = await api.listInvoices();
      const sortedInvoices = (response.invoices || []).sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setInvoices(sortedInvoices);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setInvoiceError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoadingInvoices(false);
    }
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
      'paid': 'bg-green-100 text-green-700 border border-green-300',
      'pending': 'bg-amber-100 text-amber-700 border border-amber-300',
      'overdue': 'bg-red-100 text-red-700 border border-red-300',
      'draft': 'bg-gray-100 text-gray-600 border border-gray-300'
    };
    return statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-600 border border-gray-300';
  };

  const handleInvoiceClick = (invoiceId) => {
    if (onInvoiceClick) {
      onInvoiceClick(invoiceId);
    }
    if (onNavigate) onNavigate(); // Close mobile menu
  };

  return (
    <div className="flex h-full w-80 flex-col bg-white border-r border-gray-200 shadow-sm">
      {/* Logo & New Invoice Button */}
      <div className="flex flex-col gap-4 p-4 border-b border-gray-200">
        {/* Logo */}
        <Link to="/app" className="flex items-center gap-2 px-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-navy">
            ScatterPilot
          </span>
        </Link>

        {/* New Invoice Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewInvoice}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-sage hover:bg-sage-dark text-white rounded-lg font-medium shadow-md transition-all duration-200 min-h-[44px]"
          aria-label="Create new invoice"
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
          <span>New Invoice</span>
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-4 space-y-1 border-b border-gray-200">
        {navigation.map((item) => {
          const Icon = item.current ? item.iconSolid : item.icon;

          // Handle Feedback item differently - open modal instead of navigation
          if (item.name === 'Feedback') {
            return (
              <button
                key={item.name}
                onClick={() => {
                  openFeedback();
                  if (onNavigate) onNavigate(); // Close mobile menu
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-navy-light hover:bg-cream hover:text-navy w-full text-left"
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
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${item.current
                  ? 'bg-sage text-white shadow-md'
                  : 'text-navy-light hover:bg-cream hover:text-navy'
                }
              `}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Invoice History Section */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="px-3 mb-3">
          <h3 className="text-xs font-semibold text-navy-muted uppercase tracking-wider">
            Invoice History
          </h3>
        </div>

        {isLoadingInvoices ? (
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin h-8 w-8 text-sage" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : invoiceError ? (
          <div className="px-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 mb-2">{invoiceError}</p>
              <button
                onClick={loadInvoices}
                className="text-xs text-red-600 hover:text-red-700 font-medium underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <svg
              className="w-12 h-12 text-navy-muted mb-3"
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
            <h3 className="text-sm font-medium text-navy mb-1">No invoices yet</h3>
            <p className="text-xs text-navy-muted">Create your first invoice to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {invoices.map((invoice) => (
              <button
                key={invoice.invoice_id}
                onClick={() => handleInvoiceClick(invoice.invoice_id)}
                className={`w-full text-left px-3 py-3 rounded-lg hover:bg-cream transition-all duration-200 ${
                  selectedInvoiceId === invoice.invoice_id
                    ? 'bg-sage-light border-2 border-sage shadow-md'
                    : 'border-2 border-transparent'
                }`}
              >
                <div className="space-y-2">
                  {/* Invoice Number & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-navy-muted truncate">
                      #{truncate(invoice.invoice_id, 12)}
                    </span>
                    {invoice.status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    )}
                  </div>

                  {/* Customer Name */}
                  <div className="font-semibold text-navy text-sm truncate">
                    {truncate(invoice.customer_name || invoice.invoice_data?.billTo?.company || invoice.invoice_data?.billTo?.name || 'Unknown', 25)}
                  </div>

                  {/* Amount and Date */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sage">
                      {formatCurrency(parseFloat(invoice.total || invoice.invoice_data?.total || 0))}
                    </span>
                    <span className="text-navy-muted">
                      {formatDate(invoice.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Profile */}
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
              <p className="text-sm font-medium text-navy truncate">
                {userName || userEmail || 'User'}
              </p>
              <p className="text-xs text-navy-muted truncate">View profile</p>
            </div>
            <ChevronDownIcon
              className={`h-4 w-4 text-navy-muted transition-transform duration-200 ${
                userMenuOpen ? 'transform rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
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
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleSignOut();
                  }}
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
