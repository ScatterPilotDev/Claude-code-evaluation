import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRICING, STRIPE_CONFIG } from '../config';
import apiService from '../services/api';
import authService from '../services/auth';

export default function Account() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [selectedColor, setSelectedColor] = useState('purple');
  const [colorSaving, setColorSaving] = useState(false);

  // Stripe Connect state
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [stripeDisconnecting, setStripeDisconnecting] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA'
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      console.log('[Account] Loading account data...');
      const [sub, userInfo, profileData, stripeStatus] = await Promise.all([
        apiService.getSubscription(),
        authService.getUserInfo(),
        apiService.getProfile(),
        apiService.getStripeStatus().catch(() => ({ connected: false }))
      ]);

      console.log('[Account] Subscription data:', sub);
      console.log('[Account] User info:', userInfo);
      console.log('[Account] Profile data received:', profileData);
      console.log('[Account] Profile data type:', typeof profileData);
      console.log('[Account] Stripe status:', stripeStatus);

      setSubscription(sub);
      setUserEmail(userInfo?.email || '');

      // Get user ID from session
      const session = await authService.getCurrentSession();
      const payload = session.getIdToken().decodePayload();
      setUserId(payload.sub);

      // Set Stripe connection status
      if (stripeStatus.connected && stripeStatus.stripeAccountId) {
        setStripeConnected(true);
        setStripeAccountId(stripeStatus.stripeAccountId);
      }

      // Load profile data
      if (profileData) {
        console.log('[Account] Profile data exists, setting profile state...');
        const newProfile = {
          business_name: profileData.business_name || '',
          contact_name: profileData.contact_name || '',
          email: profileData.email || userInfo?.email || '',
          phone: profileData.phone || '',
          address_line1: profileData.address_line1 || '',
          address_line2: profileData.address_line2 || '',
          city: profileData.city || '',
          state: profileData.state || '',
          zip_code: profileData.zip_code || '',
          country: profileData.country || 'USA'
        };
        console.log('[Account] New profile state:', newProfile);
        setProfile(newProfile);
      } else {
        console.log('[Account] No profile data received');
      }

      // Load invoice color preference for Pro users
      if (sub?.invoice_color) {
        setSelectedColor(sub.invoice_color);
      }

      console.log('[Account] Account data loaded successfully');
    } catch (err) {
      console.error('[Account] Failed to load account data:', err);
      console.error('[Account] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      setError('Failed to load account information.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setError('');
    setSuccess('');

    // Validate business name if provided
    if (profile.business_name && profile.business_name.trim().length > 0 && profile.business_name.trim().length < 2) {
      setError('Business name must be at least 2 characters if provided');
      setProfileSaving(false);
      return;
    }

    try {
      await apiService.updateProfile(profile);
      setSuccess('Business profile updated successfully!');
      setProfileEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfileChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleColorChange = async (color) => {
    setColorSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiService.updateInvoiceColor(color);
      setSelectedColor(color);
      setSuccess('Invoice color updated successfully!');

      // Refresh subscription data to get updated color
      const sub = await apiService.getSubscription();
      setSubscription(sub);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update color:', err);
      setError('Failed to update invoice color. Please try again.');
    } finally {
      setColorSaving(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setError('');

    try {
      const returnUrl = `${window.location.origin}/account`;
      const { url } = await apiService.createPortalSession(returnUrl);
      window.location.href = url;
    } catch (err) {
      console.error('Portal error:', err);
      setError('Failed to open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/');
  };

  const connectStripe = () => {
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

    setStripeDisconnecting(true);
    setError('');
    setSuccess('');

    try {
      await apiService.disconnectStripe();
      setStripeConnected(false);
      setStripeAccountId(null);
      setSuccess('Stripe disconnected successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('[Account] Error disconnecting Stripe:', err);
      setError('Failed to disconnect Stripe. Please try again.');
    } finally {
      setStripeDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const isPro = subscription?.subscription_status === 'pro';
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null;

  // Color options for Pro users
  const colorOptions = [
    { name: 'purple', label: 'Purple', primary: '#6B46C1', bg: '#FAF5FF' },
    { name: 'blue', label: 'Blue', primary: '#3B82F6', bg: '#EFF6FF' },
    { name: 'green', label: 'Green', primary: '#10B981', bg: '#ECFDF5' },
    { name: 'orange', label: 'Orange', primary: '#F59E0B', bg: '#FFFBEB' },
    { name: 'red', label: 'Red', primary: '#EF4444', bg: '#FEF2F2' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and subscription</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {success}
          </div>
        )}

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-gray-600 text-sm">Email</span>
              <p className="text-gray-900">{userEmail || 'Not available'}</p>
            </div>
          </div>
        </div>

        {/* Personal/Business Profile */}
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isPro ? 'Business Profile' : 'Personal Information'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isPro
                  ? 'Customize your invoice header and contact information (optional)'
                  : 'Add your contact info to make invoices more professional'}
              </p>
            </div>
            {!profileEditing && (
              <button
                onClick={() => setProfileEditing(true)}
                className="px-4 py-2 bg-gradient-brand hover:bg-gradient-brand-hover text-gray-900 rounded-lg transition-all duration-200 shadow-lg hover:shadow-glow-purple"
              >
                {isPro ? 'Edit Profile' : 'Edit Contact Info'}
              </button>
            )}
          </div>

          {!profileEditing ? (
            <div className="space-y-3">
              {/* Show business name for Pro users */}
              {isPro && profile.business_name && (
                <div>
                  <span className="text-gray-700 text-sm">Business Name</span>
                  <p className="text-gray-900">{profile.business_name}</p>
                </div>
              )}
              {isPro && !profile.business_name && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-700 text-sm">
                    No business name set. Your invoices will use the generic &quot;INVOICE&quot; header. Click &quot;Edit Profile&quot; to customize.
                  </p>
                </div>
              )}

              {/* Contact info - shown for all users (Free and Pro) */}
              {profile.contact_name && (
                <div>
                  <span className="text-gray-700 text-sm">Name</span>
                  <p className="text-gray-900">{profile.contact_name}</p>
                </div>
              )}
              {profile.phone && (
                <div>
                  <span className="text-gray-700 text-sm">Phone</span>
                  <p className="text-gray-900">{profile.phone}</p>
                </div>
              )}
              {profile.email && (
                <div>
                  <span className="text-gray-700 text-sm">Email</span>
                  <p className="text-gray-900">{profile.email}</p>
                </div>
              )}
              {(profile.address_line1 || profile.city) && (
                <div>
                  <span className="text-gray-700 text-sm">Address</span>
                  <div className="text-gray-900">
                    {profile.address_line1 && <p>{profile.address_line1}</p>}
                    {profile.address_line2 && <p>{profile.address_line2}</p>}
                    {(profile.city || profile.state || profile.zip_code) && (
                      <p>
                        {[profile.city, profile.state, profile.zip_code].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {profile.country && profile.country !== 'USA' && <p>{profile.country}</p>}
                  </div>
                </div>
              )}

              {/* Show helpful message if no contact info for Free users */}
              {!isPro && !profile.contact_name && !profile.phone && !profile.address_line1 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 font-medium">Add your contact information</p>
                  <p className="text-blue-800 text-sm mt-1">
                    Make your invoices more professional by adding your name, phone, and address. This information will appear on all your invoices.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {isPro ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <p className="text-blue-800 text-sm">
                    All fields are optional. Leave business name blank to use generic &quot;INVOICE&quot; header.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <p className="text-blue-800 text-sm">
                    Add your contact information to make invoices more professional. All fields are optional.
                  </p>
                </div>
              )}

              {/* Business Name - Pro Only */}
              {isPro && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name (optional)
                  </label>
                  <input
                    type="text"
                    value={profile.business_name}
                    onChange={(e) => handleProfileChange('business_name', e.target.value)}
                    placeholder="e.g., MAYROD, Rodriguez Consulting"
                    minLength={2}
                    maxLength={100}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>
              )}

              {/* Business Name - Free Tier (Locked) */}
              {!isPro && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name <span className="text-xs text-purple-600 font-normal">(Pro Feature)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value=""
                      disabled
                      placeholder="Upgrade to Pro to add business name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-500 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => navigate('/pricing')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-gradient-brand text-gray-900 text-xs rounded hover:bg-gradient-brand-hover transition"
                    >
                      Upgrade
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={profile.contact_name}
                    onChange={(e) => handleProfileChange('contact_name', e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => handleProfileChange('phone', e.target.value)}
                    placeholder="+1-555-0100"
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={profile.address_line1}
                  onChange={(e) => handleProfileChange('address_line1', e.target.value)}
                  placeholder="123 Main St"
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={profile.address_line2}
                  onChange={(e) => handleProfileChange('address_line2', e.target.value)}
                  placeholder="Suite 100"
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={(e) => handleProfileChange('city', e.target.value)}
                    placeholder="New York"
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={profile.state}
                    onChange={(e) => handleProfileChange('state', e.target.value)}
                    placeholder="NY"
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={profile.zip_code}
                    onChange={(e) => handleProfileChange('zip_code', e.target.value)}
                    placeholder="10001"
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) => handleProfileChange('country', e.target.value)}
                  placeholder="USA"
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-6 py-2 bg-gradient-brand text-gray-900 rounded-lg hover:bg-gradient-brand-hover disabled:bg-gray-400 transition"
                >
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileEditing(false);
                    loadAccountData();
                  }}
                  disabled={profileSaving}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-white transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Stripe Connect Section */}
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">💳 Payment Processing</h2>
            <p className="text-sm text-gray-600">Connect your Stripe account to receive payments directly from invoices</p>
          </div>

          {!stripeConnected ? (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Why connect Stripe?</h3>
                <ul className="space-y-2">
                  <li className="flex items-start text-gray-700">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Clients can pay invoices instantly with one click</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Receive payments directly to your bank account</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Accept cards, Apple Pay, Google Pay, and more</span>
                  </li>
                  <li className="flex items-start text-gray-700">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Automatic payment tracking and notifications</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={connectStripe}
                className="w-full flex items-center justify-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="#FFFFFF"/>
                  <path d="M13.3 11.2c0-.69.57-1 1.49-1 1.32 0 2.99.4 4.31 1.11V7.4a9.63 9.63 0 0 0-4.31-.9c-3.52 0-5.86 1.85-5.86 4.93 0 4.82 6.63 4.05 6.63 6.13 0 .81-.7 1.07-1.68 1.07-1.45 0-3.32-.6-4.8-1.4v3.93c1.54.65 3.11.97 4.8.97 3.61 0 6.08-1.79 6.08-4.94 0-5.2-6.66-4.27-6.66-6.39z" fill="#635BFF"/>
                </svg>
                <span>Connect with Stripe</span>
              </button>

              <p className="text-xs text-gray-600 text-center">
                Secure connection via Stripe OAuth. Your credentials are never shared with ScatterPilot.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-green-600 text-2xl">✓</div>
                  <div className="flex-1">
                    <h3 className="text-md font-semibold text-gray-900 mb-2">Stripe Connected</h3>
                    <p className="text-xs text-gray-700 font-mono mb-2">
                      Account: {stripeAccountId?.substring(0, 24)}...
                    </p>
                    <p className="text-sm text-gray-600">
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
                  className="flex-1 text-center px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Open Stripe Dashboard
                </a>

                <button
                  onClick={disconnectStripe}
                  disabled={stripeDisconnecting}
                  className="px-4 py-2 text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                >
                  {stripeDisconnecting ? 'Disconnecting...' : 'Disconnect Stripe'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subscription Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>

          <div className="flex items-center justify-between mb-4">
            <div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isPro ? 'bg-blue-100 text-blue-800' : 'bg-white text-gray-100'
              }`}>
                {isPro ? 'Pro Plan' : 'Free Plan'}
              </span>
            </div>
            {isPro && periodEnd && (
              <span className="text-sm text-gray-700">
                Renews on {periodEnd}
              </span>
            )}
          </div>

          {/* Usage */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Invoices this month</span>
              <span className="font-medium">
                {subscription?.invoices_this_month || 0}
                {!isPro && ` / ${PRICING.free.invoicesPerMonth}`}
                {isPro && ' (Unlimited)'}
              </span>
            </div>
            {!isPro && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    subscription?.invoices_remaining <= 1 ? 'bg-red-500' : 'bg-gradient-brand'
                  }`}
                  style={{
                    width: `${Math.min(
                      ((subscription?.invoices_this_month || 0) / PRICING.free.invoicesPerMonth) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isPro ? (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {portalLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </span>
                ) : (
                  'Manage Billing'
                )}
              </button>
            ) : (
              <button
                onClick={() => navigate('/pricing')}
                className="w-full py-2 px-4 bg-gradient-brand text-gray-900 rounded-lg font-medium hover:bg-gradient-brand-hover transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

        {/* Invoice Color Customization - Pro Only */}
        {isPro && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Color Theme</h2>
            <p className="text-sm text-gray-600 mb-4">
              Customize the color scheme of your PDF invoices
            </p>

            <div className="grid grid-cols-5 gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorChange(color.name)}
                  disabled={colorSaving}
                  className={`relative rounded-lg p-4 transition-all ${
                    selectedColor === color.name
                      ? 'ring-2 ring-offset-2'
                      : 'hover:scale-105'
                  } ${colorSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{
                    backgroundColor: color.bg,
                    ringColor: color.primary
                  }}
                >
                  <div
                    className="w-full h-12 rounded-md mb-2"
                    style={{ backgroundColor: color.primary }}
                  />
                  <p className="text-xs font-medium text-gray-700 text-center">
                    {color.label}
                  </p>
                  {selectedColor === color.name && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {colorSaving && (
              <div className="mt-4 text-sm text-gray-600 flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Updating color preference...
              </div>
            )}
          </div>
        )}

        {/* Free Tier - Color Upgrade Prompt */}
        {!isPro && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Color Theme</h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-3">
                Free tier invoices use a professional grayscale theme.
              </p>
              <p className="text-sm text-gray-700 font-medium mb-3">
                Upgrade to Pro to customize invoice colors!
              </p>
              <div className="flex gap-2 opacity-60">
                {colorOptions.slice(0, 3).map((color) => (
                  <div
                    key={color.name}
                    className="w-12 h-12 rounded"
                    style={{ backgroundColor: color.primary }}
                  />
                ))}
                <div className="flex items-center text-gray-700 text-xl">...</div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Features */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isPro ? 'Pro' : 'Free'} Plan Features
          </h2>
          <ul className="space-y-3">
            {(isPro ? PRICING.pro.features : PRICING.free.features).map((feature, index) => (
              <li key={index} className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-600">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/app')}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            &larr; Back to App
          </button>
          <button
            onClick={handleSignOut}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
