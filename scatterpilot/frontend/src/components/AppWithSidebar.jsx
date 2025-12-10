import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Layout, { WelcomeScreen } from './ui/Layout';
import ChatInterface from './ChatInterface';
import InvoicePreview from './InvoicePreview';
import InvoiceHistory from './InvoiceHistory';
import Login from './Login';
import Signup from './Signup';
import VerifyEmail from './VerifyEmail';
import authService from '../services/auth';
import api from '../services/api';
import analytics from '../utils/analytics';

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
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const chatInterfaceRef = useRef(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load recent invoices
  useEffect(() => {
    if (isAuthenticated) {
      loadRecentInvoices();
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

  const loadRecentInvoices = async () => {
    try {
      const invoices = await api.listInvoices();
      // Get the 5 most recent invoices
      const recent = invoices.invoices
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(inv => ({
          invoice_id: inv.invoice_id,
          client_name: inv.invoice_data?.billTo?.company || inv.invoice_data?.billTo?.name,
          starred: false // TODO: Add star functionality
        })) || [];
      setRecentInvoices(recent);
    } catch (err) {
      console.error('Failed to load recent invoices:', err);
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

    try {
      const updatedSubscription = await api.getSubscription();
      setSubscription(updatedSubscription);
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
    }
  };

  const handleInvoiceClick = async (invoiceId) => {
    console.log('[APP] Invoice clicked:', invoiceId);
    setIsLoadingInvoice(true);
    setInvoiceError(null);
    setShowWelcome(false); // Hide welcome screen when viewing invoice

    try {
      const invoice = await api.getInvoice(invoiceId);
      console.log('[APP] Fetched invoice data:', invoice);

      setSelectedInvoiceId(invoiceId);
      setCurrentInvoice({
        invoice_id: invoiceId,
        invoice_data: invoice.data, // Backend returns data nested under 'data' field
        data: invoice.data
      });
      setViewMode('viewing');
    } catch (error) {
      console.error('Failed to load invoice:', error);
      setInvoiceError('Failed to load invoice. Please try again.');
    } finally {
      setIsLoadingInvoice(false);
    }
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
    >
      {/* Main content area */}
      <div className="h-full bg-cream">
        {/* Show Welcome Screen on initial load */}
        {showWelcome ? (
          <WelcomeScreen
            userName={userName || userEmail}
            onNewInvoice={handleNewInvoice}
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
