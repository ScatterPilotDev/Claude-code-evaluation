import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from './ui/Layout';
import InvoiceCreationPanel from './InvoiceCreationPanel';
import DashboardHome from './DashboardHome';
import InvoicesPage from './InvoicesPage';
import ClientsPage from './ClientsPage';
import ClientDetailPage from './ClientDetailPage';
import OnboardingFlow from './OnboardingFlow';
import ReportsPage from './ReportsPage';
import SettingsPage from './SettingsPage';
import PricingPage from './PricingPage';
import TrialExpiredModal from './TrialExpiredModal';
import ConversionToasts from './ConversionToasts';
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

  const [refreshInvoiceList, setRefreshInvoiceList] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [billingStatus, setBillingStatus] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [allInvoices, setAllInvoices] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // Invoice creation panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelClientContext, setPanelClientContext] = useState(null);

  const [activeConversationId, setActiveConversationId] = useState(null);

  // Derive current section from URL
  const pathname = location.pathname;
  const isHome         = pathname === '/app';
  const isInvoicesList = pathname === '/app/invoices';
  const isClients      = pathname === '/app/clients';
  const isClientDetail = pathname.startsWith('/app/clients/');
  const isReports      = pathname.startsWith('/app/reports');
  const isSettings     = pathname.startsWith('/app/settings');
  const isPricing      = pathname === '/app/pricing';

  // Access helpers derived from billing state
  const isTrialExpired = billingStatus?.access?.reason === 'trial_expired' ||
    billingStatus?.subscription_status === 'expired';

  useEffect(() => {
    checkAuth();
  }, []);

  const openPanel = (clientName = null) => {
    // Gate invoice creation when trial has expired
    if (isTrialExpired) {
      setShowExpiredModal(true);
      return;
    }
    setPanelClientContext(clientName || null);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };

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
          // Backend onboarding_completed is source of truth; localStorage is fallback
          const backendCompleted = profile?.onboarding_completed === true;
          const localCompleted = localStorage.getItem('sp_onboarding_completed') === 'true';
          const completedFlag = backendCompleted || localCompleted;
          // Sync backend → localStorage when backend is the confirming source
          if (backendCompleted && !localCompleted) {
            localStorage.setItem('sp_onboarding_completed', 'true');
          }
          if (!completedFlag && !profile?.business_name) {
            setShowOnboarding(true);
          }
        } catch {
          setUserName('');
        }

        try {
          const sub = await api.getSubscription();
          setSubscription(sub);
        } catch {
          setSubscription({ subscription_status: 'free', invoices_limit: 5, invoices_this_month: 0, invoices_remaining: 5 });
        }

        try {
          const billing = await api.getBillingStatus();
          setBillingStatus(billing);
        } catch {
          setBillingStatus(null);
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

      setAllInvoices(invoices);
      setDashboardMetrics({ outstanding, receivedThisMonth, overdueCount, recentActivity });

      const completedFlag = localStorage.getItem('sp_onboarding_completed') === 'true';
      if (!completedFlag && invoices.length === 0 && !userName) {
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
    openPanel();
  };

  const handleInvoiceGenerated = async (invoice) => {
    setRefreshInvoiceList(prev => prev + 1);

    if (api.conversationId) {
      setActiveConversationId(api.conversationId);
      conversationStorage.saveActiveConversation(api.conversationId);
    }

    try {
      const updatedSubscription = await api.getSubscription();
      setSubscription(updatedSubscription);
    } catch { /* keep existing */ }
  };

  const handleInvoiceClick = (invoiceId) => {
    navigate('/app/invoices');
  };

  const handleCustomerNewInvoice = (customerName) => {
    openPanel(customerName);
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
          invoices={allInvoices}
          isLoading={isDashboardLoading}
          onNewInvoice={handleNewInvoice}
          onInvoiceClick={handleInvoiceClick}
          onClientNewInvoice={handleCustomerNewInvoice}
        />
      );
    }

    if (isClients) {
      return <ClientsPage onClientNewInvoice={handleCustomerNewInvoice} />;
    }

    if (isClientDetail) {
      return <ClientDetailPage onClientNewInvoice={handleCustomerNewInvoice} />;
    }

    if (isReports) {
      return <ReportsPage />;
    }

    if (isSettings) {
      return <SettingsPage />;
    }

    if (isPricing) {
      return <PricingPage currentStatus={billingStatus} />;
    }

    // /app/invoices — filterable invoice list
    if (isInvoicesList) {
      return (
        <InvoicesPage
          subscription={subscription}
          onNewInvoice={handleNewInvoice}
        />
      );
    }

    // Fallback — dashboard
    return (
      <DashboardHome
        userName={userName || userEmail}
        invoices={allInvoices}
        isLoading={isDashboardLoading}
        onNewInvoice={handleNewInvoice}
        onInvoiceClick={handleInvoiceClick}
        onClientNewInvoice={handleCustomerNewInvoice}
      />
    );
  };

  // ── Full-screen onboarding (no sidebar/nav) ──────────────────────────────
  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={({ clientName, clientCreated }) => {
          setShowOnboarding(false);
          loadDashboardData();
          if (clientCreated && clientName) {
            openPanel(clientName);
          }
        }}
      />
    );
  }

  return (
    <Layout onNewInvoice={handleNewInvoice} billingStatus={billingStatus}>
      {/* Invoice creation slide-over panel */}
      <InvoiceCreationPanel
        isOpen={isPanelOpen}
        clientContext={panelClientContext}
        onClose={closePanel}
        onInvoiceCreated={handleInvoiceGenerated}
        subscription={subscription}
      />

      {/* Trial expired gate modal */}
      <TrialExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />

      {/* Achievement-based upgrade prompts */}
      <ConversionToasts billingStatus={billingStatus} />

      {renderContent()}
    </Layout>
  );
}
