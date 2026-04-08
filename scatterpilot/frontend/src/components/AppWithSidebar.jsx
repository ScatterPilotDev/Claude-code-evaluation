import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './ui/Layout';
import ChatInterface from './ChatInterface';
import InvoicePreview from './InvoicePreview';
import CustomerProfile from './CustomerProfile';
import DashboardHome from './DashboardHome';
import OnboardingOverlay from './OnboardingOverlay';
import Login from './Login';
import Signup from './Signup';
import VerifyEmail from './VerifyEmail';
import authService from '../services/auth';
import api from '../services/api';
import analytics from '../utils/analytics';
import conversationStorage from '../utils/conversationStorage';

// ── Placeholder pages for routes not yet redesigned ─────────────────────────

function ComingSoonPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-sage-50 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-sage-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 className="text-heading text-ink-primary mb-2">{title}</h2>
      <p className="text-body text-ink-secondary">This section is coming soon.</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AppWithSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);
  const [refreshInvoiceList, setRefreshInvoiceList] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [viewMode, setViewMode] = useState('new');
  const [subscription, setSubscription] = useState(null);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const chatInterfaceRef = useRef(null);

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [refreshConversationList, setRefreshConversationList] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Derive current section from URL
  const pathname = location.pathname;
  const isHome     = pathname === '/app';
  const isInvoices = pathname.startsWith('/app/invoices');
  const isClients  = pathname.startsWith('/app/clients');
  const isReports  = pathname.startsWith('/app/reports');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const savedConversationId = conversationStorage.getActiveConversation();
      if (savedConversationId) {
        setActiveConversationId(savedConversationId);
        api.loadConversation(savedConversationId);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, refreshInvoiceList]);

  const checkAuth = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const userInfo = await authService.getUserInfo();
        setUserEmail(userInfo.email || '');

        try {
          const profile = await api.getProfile();
          setUserName(profile?.contact_name || '');
        } catch {
          setUserName('');
        }

        try {
          const sub = await api.getSubscription();
          setSubscription(sub);
        } catch {
          setSubscription({ subscription_status: 'free', invoices_limit: 5, invoices_this_month: 0, invoices_remaining: 5 });
        }
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setIsDashboardLoading(true);
    try {
      const authenticated = await authService.isAuthenticated();
      if (!authenticated) return;

      const response = await api.listInvoices();
      const invoices = response.invoices || [];

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const outstanding = invoices
        .filter(i => !['paid', 'cancelled'].includes(i.status))
        .reduce((sum, i) => sum + parseFloat(i.total || i.invoice_data?.total || 0), 0);

      const receivedThisMonth = invoices
        .filter(i => {
          if (i.status !== 'paid') return false;
          const d = new Date(i.updated_at || i.created_at);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((sum, i) => sum + parseFloat(i.total || i.invoice_data?.total || 0), 0);

      const overdueCount = invoices.filter(i => {
        if (['paid', 'cancelled'].includes(i.status)) return false;
        if (i.status === 'overdue') return true;
        const due = i.invoice_data?.due_date || i.invoice_data?.dueDate;
        return due && new Date(due) < now;
      }).length;

      const recentActivity = [...invoices]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3)
        .map(inv => ({
          invoice_id: inv.invoice_id,
          client_name: inv.customer_name || inv.invoice_data?.billTo?.company || inv.invoice_data?.billTo?.name || 'Unknown',
          amount: parseFloat(inv.total || inv.invoice_data?.total || 0),
          status: inv.status || 'draft',
          date: inv.created_at,
        }));

      setDashboardMetrics({ outstanding, receivedThisMonth, overdueCount, recentActivity });

      if (invoices.length === 0 && !userName) {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    await checkAuth();
    analytics.trackLogin('email');
  };

  const handleSignupSuccess = async (email, password) => {
    try {
      await authService.signIn(email, password);
      await checkAuth();
      analytics.trackSignup('email');
    } catch {
      setShowSignup(false);
      setShowVerify(false);
    }
  };

  const handleNeedVerification = (email) => {
    setPendingEmail(email);
    setShowSignup(false);
    setShowVerify(true);
  };

  const handleVerificationSuccess = () => {
    setShowVerify(false);
    setShowSignup(false);
    setPendingEmail('');
  };

  const handleBackToSignup = () => {
    setShowVerify(false);
    setShowSignup(true);
  };

  const handleNewInvoice = () => {
    setCurrentInvoice(null);
    setSelectedInvoiceId(null);
    setInvoiceError(null);
    setViewMode('new');
    setSelectedCustomer(null);
    if (chatInterfaceRef.current) {
      chatInterfaceRef.current.resetConversation();
    }
    navigate('/app/invoices');
  };

  const handleInvoiceGenerated = async (invoice) => {
    setCurrentInvoice(invoice);
    setSelectedInvoiceId(invoice.invoice_id);
    setViewMode('created');
    setRefreshInvoiceList(prev => prev + 1);

    if (api.conversationId) {
      setActiveConversationId(api.conversationId);
      conversationStorage.saveActiveConversation(api.conversationId);
      setRefreshConversationList(prev => prev + 1);
    }

    try {
      const updatedSubscription = await api.getSubscription();
      setSubscription(updatedSubscription);
    } catch { /* keep existing */ }
  };

  const handleInvoiceClick = async (invoiceId, customerName) => {
    setIsLoadingInvoice(true);
    setInvoiceError(null);
    navigate('/app/invoices');

    try {
      const invoice = await api.getInvoice(invoiceId);
      api.clearConversation();
      setActiveConversationId(null);
      conversationStorage.clearActiveConversation();
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.resetConversation();
        if (customerName) {
          chatInterfaceRef.current.prefillInput(`Create a new invoice for ${customerName}`);
        }
      }
      setSelectedInvoiceId(invoiceId);
      setCurrentInvoice({ invoice_id: invoiceId, invoice_data: invoice.data, data: invoice.data, status: invoice.status || 'draft' });
      setViewMode('viewing');
    } catch {
      setInvoiceError('Failed to load invoice. Please try again.');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const handleCustomerNewInvoice = (customerName) => {
    setSelectedCustomer(null);
    handleNewInvoice();
    if (chatInterfaceRef.current) {
      chatInterfaceRef.current.setCustomerContext?.(customerName);
      chatInterfaceRef.current.prefillInput(`Create a new invoice for ${customerName}`);
    }
  };

  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer);
    navigate('/app/clients');
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-sage-200 border-t-sage-500"></div>
          <p className="mt-4 text-body text-ink-secondary">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Auth screens ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (showVerify) {
      return <VerifyEmail email={pendingEmail} onVerificationSuccess={handleVerificationSuccess} onBack={handleBackToSignup} />;
    }
    if (showSignup) {
      return <Signup onSignupSuccess={handleSignupSuccess} onNeedVerification={handleNeedVerification} onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <Login onLoginSuccess={handleLoginSuccess} onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // ── Render content based on current route ────────────────────────────────
  const renderContent = () => {
    if (isHome) {
      return (
        <DashboardHome
          userName={userName || userEmail}
          metrics={dashboardMetrics}
          isLoading={isDashboardLoading}
          onNewInvoice={handleNewInvoice}
          onInvoiceClick={handleInvoiceClick}
        />
      );
    }

    if (isClients) {
      if (selectedCustomer) {
        return (
          <CustomerProfile
            customerName={selectedCustomer.customer_name}
            onNewInvoice={handleCustomerNewInvoice}
            onBack={() => setSelectedCustomer(null)}
          />
        );
      }
      return <ComingSoonPage title="Clients" />;
    }

    if (isReports) {
      return <ComingSoonPage title="Reports" />;
    }

    // /app/invoices — chat + invoice preview
    if (isInvoices) {
      return (
        <div className="-mx-8 -my-8 h-[calc(100vh-0px)] flex overflow-hidden">
          <div className="flex-1 h-full">
            <ChatInterface
              ref={chatInterfaceRef}
              onInvoiceGenerated={handleInvoiceGenerated}
              viewMode={viewMode}
              onNewInvoice={handleNewInvoice}
              onMessageSent={() => setRefreshConversationList(prev => prev + 1)}
            />
          </div>

          <AnimatePresence>
            {currentInvoice && (
              <motion.div
                key="invoice-preview"
                initial={{ x: 384, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 384, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-96 h-full border-l border-surface-border bg-surface-card"
              >
                <InvoicePreview
                  invoiceId={currentInvoice.invoice_id}
                  invoiceData={currentInvoice.data || currentInvoice.invoice_data}
                  invoiceStatus={currentInvoice.status || 'draft'}
                  onNewInvoice={handleNewInvoice}
                  subscription={subscription}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Fallback — redirect to home
    return (
      <DashboardHome
        userName={userName || userEmail}
        metrics={dashboardMetrics}
        isLoading={isDashboardLoading}
        onNewInvoice={handleNewInvoice}
        onInvoiceClick={handleInvoiceClick}
      />
    );
  };

  return (
    <Layout onNewInvoice={handleNewInvoice}>
      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingOverlay
          onComplete={() => {
            setShowOnboarding(false);
            handleNewInvoice();
          }}
        />
      )}

      {renderContent()}

      {/* Loading overlay */}
      {isLoadingInvoice && (
        <div className="fixed inset-0 bg-ink-primary/40 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-card p-6 shadow-modal">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-sage-100 border-t-sage-500 mx-auto"></div>
            <p className="mt-4 text-body text-ink-primary text-center">Loading invoice…</p>
          </div>
        </div>
      )}

      {/* Error toast */}
      {invoiceError && (
        <div className="fixed bottom-5 right-5 bg-danger-400 text-white px-5 py-3.5 rounded-card shadow-modal z-50">
          <p className="text-body">{invoiceError}</p>
          <button
            onClick={() => setInvoiceError(null)}
            className="mt-1.5 text-body-sm underline hover:no-underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </Layout>
  );
}
