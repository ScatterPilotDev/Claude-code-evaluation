import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './ui/Layout';
import ChatInterface from './ChatInterface';
import InvoicePreview from './InvoicePreview';
import CustomerProfile from './CustomerProfile';
import InvoiceHistory from './InvoiceHistory';
import Login from './Login';
import Signup from './Signup';
import VerifyEmail from './VerifyEmail';
import DashboardHome from './DashboardHome';
import OnboardingOverlay from './OnboardingOverlay';
import authService from '../services/auth';
import api from '../services/api';
import analytics from '../utils/analytics';
import conversationStorage from '../utils/conversationStorage';

export default function AppWithSidebar() {
  const navigate = useNavigate();
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
  const [showWelcome, setShowWelcome] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const chatInterfaceRef = useRef(null);

  // Conversation state
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [refreshConversationList, setRefreshConversationList] = useState(0);

  // Customer profile state
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load active conversation from localStorage on mount
  useEffect(() => {
    if (isAuthenticated) {
      const savedConversationId = conversationStorage.getActiveConversation();
      if (savedConversationId) {
        console.log('[APP] Loaded conversation from storage:', savedConversationId);
        setActiveConversationId(savedConversationId);
        api.loadConversation(savedConversationId);
      }
    }
  }, [isAuthenticated]);

  // Load dashboard data
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

        // Load user profile to get contact_name
        try {
          const profile = await api.getProfile();
          setUserName(profile?.contact_name || '');
        } catch (err) {
          console.error('Failed to load profile:', err);
          setUserName('');
        }

        try {
          const sub = await api.getSubscription();
          setSubscription(sub);
        } catch (err) {
          console.error('Failed to load subscription:', err);
          setSubscription({
            subscription_status: 'free',
            invoices_limit: 5,
            invoices_this_month: 0,
            invoices_remaining: 5
          });
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthError = (err) => {
    const msg = (err?.message || '').toLowerCase();
    return (
      msg.includes('not authenticated') ||
      msg.includes('authentication required') ||
      msg.includes('no user logged in') ||
      msg.includes('session expired') ||
      msg.includes('cognito not configured') ||
      msg.includes('url is not valid') ||
      msg.includes('user credentials')
    );
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

      // Show onboarding for new users with no invoices and incomplete profile
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
    } catch (error) {
      console.error('Auto-login after signup failed:', error);
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
    console.log('[APP] handleNewInvoice called');
    setCurrentInvoice(null);
    setSelectedInvoiceId(null);
    setInvoiceError(null);
    setViewMode('new');
    setShowWelcome(false); // Hide welcome screen, show chat interface
    if (chatInterfaceRef.current) {
      chatInterfaceRef.current.resetConversation();
    }
  };

  const handleInvoiceGenerated = async (invoice) => {
    console.log('[APP] Invoice generated:', invoice);
    setCurrentInvoice(invoice);
    setSelectedInvoiceId(invoice.invoice_id);
    setViewMode('created');
    setRefreshInvoiceList(prev => prev + 1);

    // Save active conversation if we have one
    if (api.conversationId) {
      setActiveConversationId(api.conversationId);
      conversationStorage.saveActiveConversation(api.conversationId);
      // Refresh conversation list to show the new/updated conversation
      setRefreshConversationList(prev => prev + 1);
    }

    try {
      const updatedSubscription = await api.getSubscription();
      setSubscription(updatedSubscription);
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
    }
  };

  const handleInvoiceClick = async (invoiceId, customerName) => {
    console.log('[APP] Invoice clicked:', invoiceId, customerName);
    setIsLoadingInvoice(true);
    setInvoiceError(null);
    setShowWelcome(false);

    try {
      const invoice = await api.getInvoice(invoiceId);
      console.log('[APP] Fetched invoice data:', invoice);

      // Start a fresh conversation pre-filled with the customer's name
      api.clearConversation();
      setActiveConversationId(null);
      conversationStorage.clearActiveConversation();
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.resetConversation();
        if (customerName) {
          chatInterfaceRef.current.prefillInput(
            `Create a new invoice for ${customerName}`
          );
        }
      }

      setSelectedInvoiceId(invoiceId);
      setCurrentInvoice({
        invoice_id: invoiceId,
        invoice_data: invoice.data,
        data: invoice.data,
        status: invoice.status || 'draft'
      });
      setViewMode('viewing');
    } catch (error) {
      console.error('Failed to load invoice:', error);
      setInvoiceError('Failed to load invoice. Please try again.');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const handleConversationDelete = (deletedId) => {
    console.log('[APP] Conversation deleted:', deletedId);
    if (activeConversationId === deletedId) {
      setActiveConversationId(null);
      conversationStorage.clearActiveConversation();
      api.clearConversation();
      handleNewInvoice();
    }
    setRefreshConversationList(prev => prev + 1);
  };

  // Conversation handlers
  const handleConversationSelect = async (conversation) => {
    console.log('[APP] Conversation selected:', conversation);

    setActiveConversationId(conversation.conversation_id);
    conversationStorage.saveActiveConversation(conversation.conversation_id);
    api.loadConversation(conversation.conversation_id);

    // Always show the chat panel immediately
    setShowWelcome(false);
    setCurrentInvoice(null);
    setSelectedInvoiceId(null);

    try {
      const conversationData = await api.getConversation(conversation.conversation_id);
      console.log('[APP] Loaded conversation data:', conversationData);

      // Load messages into ChatInterface
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.loadConversation(
          conversationData.messages || [],
          conversation.conversation_id,
          conversation.customer_name || null
        );
      }

      // If conversation produced an invoice, find it and show the preview
      if (conversation.has_invoice) {
        setViewMode('created');
        try {
          const invoicesResponse = await api.listInvoices();
          // Sort descending by created_at so the most recent invoice is shown
          const match = (invoicesResponse.invoices || [])
            .filter(inv => inv.conversation_id === conversation.conversation_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          if (match) {
            const fullInvoice = await api.getInvoice(match.invoice_id);
            setCurrentInvoice({
              invoice_id: match.invoice_id,
              invoice_data: fullInvoice.data,
              data: fullInvoice.data,
              status: match.status || 'draft'
            });
            setSelectedInvoiceId(match.invoice_id);
          }
        } catch (err) {
          console.error('[APP] Failed to load invoice for conversation:', err);
        }
      } else {
        setViewMode('new');
      }

    } catch (error) {
      console.error('[APP] Failed to load conversation:', error);
      // Fall back to empty chat for this conversation
      setViewMode('new');
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.loadConversation([], conversation.conversation_id);
      }
    }
  };

  const handleNewConversation = () => {
    console.log('[APP] New conversation requested');

    // Clear active conversation
    setActiveConversationId(null);
    conversationStorage.clearActiveConversation();
    api.clearConversation();

    // Start fresh invoice conversation
    handleNewInvoice();

    // Refresh conversation list
    setRefreshConversationList(prev => prev + 1);
  };

  const handleCustomerNewInvoice = (customerName, customerEmail) => {
    console.log('[APP] New invoice for customer:', customerName);
    setSelectedCustomer(null);
    handleNewInvoice();
    if (chatInterfaceRef.current) {
      chatInterfaceRef.current.setCustomerContext(customerName);
      chatInterfaceRef.current.prefillInput(
        `Create a new invoice for ${customerName}`
      );
    }
  };

  const handleCustomerClick = (customer) => {
    console.log('[APP] Customer profile opened:', customer.customer_name);
    setSelectedCustomer(customer);
    setShowWelcome(false);
  };

  // Show loading spinner during auth check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sage"></div>
          <p className="mt-4 text-navy-light">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login/signup if not authenticated
  if (!isAuthenticated) {
    if (showVerify) {
      return <VerifyEmail email={pendingEmail} onVerificationSuccess={handleVerificationSuccess} onBack={handleBackToSignup} />;
    }

    if (showSignup) {
      return <Signup onSignupSuccess={handleSignupSuccess} onNeedVerification={handleNeedVerification} onSwitchToLogin={() => setShowSignup(false)} />;
    }

    return <Login onLoginSuccess={handleLoginSuccess} onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // Main app with new sidebar layout
  return (
    <Layout
      onNewInvoice={handleNewInvoice}
      onInvoiceClick={handleInvoiceClick}
      selectedInvoiceId={selectedInvoiceId}
      refreshInvoiceList={refreshInvoiceList}
      onConversationSelect={handleConversationSelect}
      onConversationDelete={handleConversationDelete}
      activeConversationId={activeConversationId}
      onNewConversation={handleNewConversation}
      refreshConversationList={refreshConversationList}
      onCustomerNewInvoice={handleCustomerNewInvoice}
      onCustomerClick={handleCustomerClick}
    >
      {/* Onboarding overlay for new users */}
      {showOnboarding && (
        <OnboardingOverlay
          onComplete={() => {
            setShowOnboarding(false);
            handleNewInvoice();
          }}
        />
      )}

      {/* Main content area */}
      <div className="h-full bg-cream">
        {/* Customer Profile view */}
        {selectedCustomer ? (
          <CustomerProfile
            customerName={selectedCustomer.customer_name}
            onNewInvoice={handleCustomerNewInvoice}
            onBack={() => setSelectedCustomer(null)}
          />
        ) : showWelcome ? (
          <DashboardHome
            userName={userName || userEmail}
            metrics={dashboardMetrics}
            isLoading={isDashboardLoading}
            onNewInvoice={handleNewInvoice}
            onInvoiceClick={handleInvoiceClick}
          />
        ) : (
          <div className="h-full flex">
            {/* Main - Chat Interface (full width) */}
            <div className="flex-1 h-full">
              <ChatInterface
                ref={chatInterfaceRef}
                onInvoiceGenerated={handleInvoiceGenerated}
                viewMode={viewMode}
                onNewInvoice={handleNewInvoice}
                onMessageSent={() => setRefreshConversationList(prev => prev + 1)}
              />
            </div>

            {/* Right side - Invoice Preview (when invoice exists) */}
            <AnimatePresence>
              {currentInvoice && (
                <motion.div
                  key="invoice-preview"
                  initial={{ x: 384, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 384, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="w-96 h-full border-l border-gray-200 bg-white"
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
        )}

        {/* Loading overlay */}
        {isLoadingInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 shadow-2xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sage mx-auto"></div>
              <p className="mt-4 text-navy">Loading invoice...</p>
            </div>
          </div>
        )}

        {/* Error toast */}
        {invoiceError && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl z-50">
            <p>{invoiceError}</p>
            <button
              onClick={() => setInvoiceError(null)}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
