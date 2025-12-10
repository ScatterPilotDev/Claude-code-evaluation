import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatInterface from './components/ChatInterface';
import InvoicePreview from './components/InvoicePreview';
import InvoiceHistory from './components/InvoiceHistory';
import Login from './components/Login';
import Signup from './components/Signup';
import VerifyEmail from './components/VerifyEmail';
import ErrorBoundary from './components/ErrorBoundary';
import authService from './services/auth';
import api from './services/api';
import analytics from './utils/analytics';
import { GA4_CONFIG } from './config';

export default function App() {
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
  const [viewMode, setViewMode] = useState('new'); // 'new', 'created', or 'viewing'
  const [subscription, setSubscription] = useState(null);
  const chatInterfaceRef = useRef(null);

  // Initialize Google Analytics
  useEffect(() => {
    if (GA4_CONFIG.measurementId) {
      analytics.initialize(GA4_CONFIG.measurementId);
      console.log('[Analytics] GA4 initialized');
    } else {
      console.warn('[Analytics] No GA4 Measurement ID configured');
    }
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (analytics.isInitialized()) {
      analytics.pageView(location.pathname + location.search, document.title);
    }
  }, [location]);

  // Debug state changes
  useEffect(() => {
    console.log('[APP STATE] viewMode:', viewMode);
  }, [viewMode]);

  useEffect(() => {
    console.log('[APP STATE] currentInvoice:', currentInvoice);
  }, [currentInvoice]);

  useEffect(() => {
    console.log('[APP STATE] selectedInvoiceId:', selectedInvoiceId);
  }, [selectedInvoiceId]);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    console.log('[APP] checkAuth - START');
    try {
      const authenticated = await authService.isAuthenticated();
      console.log('[APP] Authentication status:', authenticated);
      setIsAuthenticated(authenticated);

      if (authenticated) {
        console.log('[APP] User is authenticated, loading user info...');
        const userInfo = await authService.getUserInfo();
        setUserEmail(userInfo.email || '');
        console.log('[APP] User email:', userInfo.email);

        // Load subscription info - CRITICAL for usage counter
        try {
          console.log('[APP] Fetching subscription from API...');
          const sub = await api.getSubscription();
          console.log('[APP] Subscription data received:', sub);
          console.log('[APP] Subscription status:', sub?.subscription_status);
          console.log('[APP] Invoices remaining:', sub?.invoices_remaining);

          // Ensure subscription has all required fields
          if (sub && sub.subscription_status) {
            setSubscription(sub);
            console.log('[APP] Subscription state updated successfully');
          } else {
            console.warn('[APP] Subscription data incomplete, using defaults');
            setSubscription({
              subscription_status: 'free',
              invoices_limit: 5,
              invoices_this_month: 0,
              invoices_remaining: 5
            });
          }
        } catch (err) {
          console.error('[APP] Failed to load subscription:', err);
          console.error('[APP] Error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
          });
          // Set default free tier if API call fails
          // This ensures the counter is ALWAYS visible
          console.log('[APP] Setting default subscription values');
          setSubscription({
            subscription_status: 'free',
            invoices_limit: 5,
            invoices_this_month: 0,
            invoices_remaining: 5
          });
        }
      }
    } catch (error) {
      console.error('[APP] Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      console.log('[APP] checkAuth - COMPLETE');
    }
  };

  const handleLoginSuccess = async () => {
    await checkAuth();
    analytics.trackLogin('email');
  };

  const handleSignupSuccess = async (email, password) => {
    try {
      // Auto-login after signup (for admin-created users that are auto-confirmed)
      await authService.signIn(email, password);
      await checkAuth();
      analytics.trackSignup('email');
    } catch (error) {
      console.error('Auto-login after signup failed:', error);
      // If auto-login fails, just switch to login page
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
    // After successful verification, go to login page
    setShowVerify(false);
    setShowSignup(false);
    setPendingEmail('');
  };

  const handleBackToSignup = () => {
    setShowVerify(false);
    setShowSignup(true);
  };

  const handleLogout = () => {
    authService.signOut();
    analytics.trackLogout();
    setIsAuthenticated(false);
    setUserEmail('');
    setCurrentInvoice(null);
    setSelectedInvoiceId(null);
  };

  const handleNewInvoice = () => {
    console.log('[APP] handleNewInvoice called');
    setCurrentInvoice(null);
    setSelectedInvoiceId(null);
    setInvoiceError(null);
    setViewMode('new');
    if (chatInterfaceRef.current) {
      chatInterfaceRef.current.resetConversation();
    }
    console.log('[APP] handleNewInvoice complete');
  };

  const handleInvoiceGenerated = async (invoice) => {
    console.log('[APP] Invoice generated:', invoice);
    setCurrentInvoice(invoice);
    setSelectedInvoiceId(invoice.invoice_id);
    // Stay in 'new' mode but with invoice showing - don't switch to 'viewing'
    // This prevents remounting the ChatInterface and keeps conversation visible
    setViewMode('created');
    // Trigger refresh of invoice list
    setRefreshInvoiceList(prev => prev + 1);

    // CRITICAL: Refresh subscription to update invoice counter
    try {
      const updatedSubscription = await api.getSubscription();
      setSubscription(updatedSubscription);
      console.log('[APP] Subscription refreshed:', updatedSubscription);
    } catch (err) {
      console.error('[APP] Failed to refresh subscription:', err);
      // Keep existing subscription data if refresh fails
      // Don't overwrite with defaults here since we might have valid cached data
    }
  };

  const handleInvoiceSelect = async (invoice) => {
    console.log('[APP] handleInvoiceSelect called with invoice:', invoice);
    setSelectedInvoiceId(invoice.invoice_id);
    setIsLoadingInvoice(true);
    setInvoiceError(null);

    try {
      // Fetch full invoice details
      console.log('[APP] Fetching invoice:', invoice.invoice_id);
      const fullInvoice = await api.getInvoice(invoice.invoice_id);
      console.log('[APP] Received full invoice:', fullInvoice);

      setCurrentInvoice(fullInvoice);
      setViewMode('viewing');
    } catch (error) {
      console.error('[APP] Failed to load invoice:', error);
      setInvoiceError(error.message || 'Failed to load invoice');
      setCurrentInvoice(null);
      setViewMode('new');
    } finally {
      setIsLoadingInvoice(false);
      console.log('[APP] handleInvoiceSelect complete');
    }
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show Login/Signup/Verify if not authenticated
  if (!isAuthenticated) {
    if (showVerify) {
      return (
        <VerifyEmail
          email={pendingEmail}
          onVerificationSuccess={handleVerificationSuccess}
          onBackToSignup={handleBackToSignup}
        />
      );
    }

    if (showSignup) {
      return (
        <Signup
          onSignupSuccess={handleSignupSuccess}
          onNeedVerification={handleNeedVerification}
          onSwitchToLogin={() => setShowSignup(false)}
        />
      );
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToSignup={() => setShowSignup(true)}
      />
    );
  }

  // Show main app if authenticated
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm relative z-30">
        <div className="max-w-full mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">ScatterPilot</h1>
            <div className="flex items-center space-x-4">
              {/* Subscription badge with color coding - ALWAYS show, never hide */}
              {subscription ? (
                <>
                  {subscription.subscription_status === 'pro' ? (
                    <span className="px-3 py-1.5 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                      ✨ Pro
                    </span>
                  ) : (
                    <span className={`px-3 py-1.5 text-sm font-semibold rounded-full ${
                      subscription.invoices_remaining === 0
                        ? 'bg-red-100 text-red-800'
                        : subscription.invoices_remaining <= 2
                        ? 'bg-orange-100 text-orange-800'
                        : subscription.invoices_remaining <= 4
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {subscription.invoices_remaining === 0 ? '🔒 0 left - Upgrade' :
                       subscription.invoices_remaining <= 2 ? `⚠️ ${subscription.invoices_remaining} left` :
                       `${subscription.invoices_remaining} left`}
                    </span>
                  )}
                </>
              ) : (
                <span className="px-3 py-1.5 text-sm font-semibold rounded-full bg-gray-100 text-gray-600 animate-pulse">
                  Loading...
                </span>
              )}
              <span className="text-sm text-gray-600">{userEmail}</span>
              <button
                onClick={() => navigate('/pricing')}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => navigate('/account')}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Account
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex h-[calc(100vh-5rem)]">
        {/* Invoice History Sidebar */}
        <InvoiceHistory
          onInvoiceSelect={handleInvoiceSelect}
          selectedInvoiceId={selectedInvoiceId}
          onNewInvoice={handleNewInvoice}
          refreshTrigger={refreshInvoiceList}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full px-4 py-8 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                {/* Chat Panel */}
                <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
                  <ChatInterface
                    key={viewMode === 'viewing' ? `chat-viewing-${selectedInvoiceId}` : 'chat-new'}
                    ref={chatInterfaceRef}
                    onInvoiceGenerated={handleInvoiceGenerated}
                    viewMode={viewMode}
                    onNewInvoice={handleNewInvoice}
                  />
                </div>

                {/* Invoice Preview Panel */}
                <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
                  {isLoadingInvoice ? (
                    <div className="flex items-center justify-center h-full bg-white rounded-lg shadow-lg">
                      <div className="text-center">
                        <svg className="animate-spin h-12 w-12 mx-auto text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-4 text-gray-600">Loading invoice...</p>
                      </div>
                    </div>
                  ) : invoiceError ? (
                    <div className="flex items-center justify-center h-full bg-white rounded-lg shadow-lg">
                      <div className="text-center px-8">
                        <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load invoice</h3>
                        <p className="text-sm text-gray-600 mb-4">{invoiceError}</p>
                        <button
                          onClick={() => handleInvoiceSelect({ invoice_id: selectedInvoiceId })}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <InvoicePreview
                      key={`preview-${selectedInvoiceId || 'new'}`}
                      invoice={currentInvoice}
                      onNewInvoice={handleNewInvoice}
                      viewMode={viewMode}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
    </ErrorBoundary>
  );
}
