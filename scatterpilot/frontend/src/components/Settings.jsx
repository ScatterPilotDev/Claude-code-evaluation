import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { STRIPE_CONFIG } from '../config';
import apiService from '../services/api';
import authService from '../services/auth';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Get user ID from JWT token
      const session = await authService.getCurrentSession();
      const payload = session.getIdToken().decodePayload();
      const userSub = payload.sub;
      setUserId(userSub);

      // Check Stripe connection status
      const stripeStatus = await apiService.getStripeStatus();

      if (stripeStatus.connected && stripeStatus.stripeAccountId) {
        setStripeConnected(true);
        setStripeAccountId(stripeStatus.stripeAccountId);
      }
    } catch (err) {
      console.error('[Settings] Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const connectStripe = () => {
    // Redirect to Stripe OAuth with ACTUAL Client ID
    const stripeAuthUrl =
      `https://connect.stripe.com/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${STRIPE_CONFIG.clientId}&` +
      `scope=read_write&` +
      `state=${userId}&` +
      `redirect_uri=${encodeURIComponent(STRIPE_CONFIG.redirectUri)}`;

    window.location.href = stripeAuthUrl;
  };

  const disconnectStripe = async () => {
    if (!confirm('Are you sure you want to disconnect Stripe? You will no longer be able to receive payments through ScatterPilot.')) {
      return;
    }

    setDisconnecting(true);
    setError('');
    setSuccess('');

    try {
      await apiService.disconnectStripe();

      setStripeConnected(false);
      setStripeAccountId(null);
      setSuccess('Stripe disconnected successfully');
    } catch (err) {
      console.error('[Settings] Error disconnecting Stripe:', err);
      setError('Failed to disconnect Stripe. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/app')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Stripe Connection Section */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">💳 Payment Processing</h2>
            <p className="text-gray-600">Connect your Stripe account to receive payments directly from invoices</p>
          </div>

          {!stripeConnected ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Why connect Stripe?</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Clients can pay invoices instantly with one click</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Receive payments directly to your bank account</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Accept cards, Apple Pay, Google Pay, and more</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Automatic payment tracking and notifications</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={connectStripe}
                className="w-full sm:w-auto flex items-center justify-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="#FFFFFF"/>
                  <path d="M13.3 11.2c0-.69.57-1 1.49-1 1.32 0 2.99.4 4.31 1.11V7.4a9.63 9.63 0 0 0-4.31-.9c-3.52 0-5.86 1.85-5.86 4.93 0 4.82 6.63 4.05 6.63 6.13 0 .81-.7 1.07-1.68 1.07-1.45 0-3.32-.6-4.80-1.4v3.93c1.54.65 3.11.97 4.8.97 3.61 0 6.08-1.79 6.08-4.94 0-5.2-6.66-4.27-6.66-6.39z" fill="#635BFF"/>
                </svg>
                <span>Connect with Stripe</span>
              </button>

              <p className="text-sm text-gray-500">
                Secure connection via Stripe OAuth. Your credentials are never shared with ScatterPilot.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="text-green-600 text-3xl">✓</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Stripe Connected</h3>
                    <p className="text-sm text-gray-600 font-mono mb-3">
                      Account: {stripeAccountId.substring(0, 24)}...
                    </p>
                    <p className="text-sm text-gray-700">
                      You're all set to receive payments! Add payment links to your invoices to get paid faster.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Open Stripe Dashboard
                </a>

                <button
                  onClick={disconnectStripe}
                  disabled={disconnecting}
                  className="px-6 py-3 text-red-600 hover:text-red-800 font-medium transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect Stripe'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Future Settings Sections */}
        <section className="bg-white rounded-lg shadow-md p-8 opacity-50">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Additional Settings</h2>
          <p className="text-gray-600">More settings coming soon...</p>
        </section>
      </main>
    </div>
  );
}
