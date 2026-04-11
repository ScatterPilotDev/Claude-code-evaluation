/**
 * Settings page — /app/settings (and /app/settings/payments)
 *
 * Shows the Payments card with three connection states:
 *   1. Not connected  — prompt to connect Stripe
 *   2. Incomplete     — onboarding started but details not submitted
 *   3. Connected      — fully active, link to Stripe dashboard
 *
 * URL params handled:
 *   ?onboarding=complete  → success toast + refresh status
 *   ?refresh=true         → auto-trigger reconnect flow
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import authService from '../services/auth';
import Input, { TextArea } from './ui/Input';

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg = type === 'success' ? 'bg-success-50 border-success-200 text-success-700' : 'bg-danger-50 border-danger-200 text-danger-700';

  return (
    <div className={`fixed bottom-20 left-4 right-4 md:bottom-auto md:top-4 md:left-auto md:right-4 md:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-lg border text-body-sm shadow-md ${bg}`}>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="ml-1 text-inherit opacity-60 hover:opacity-100 focus-visible:outline-none">✕</button>
    </div>
  );
}

// ── Status icons ─────────────────────────────────────────────────────────────

function IconCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconWarning({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconExternalLink({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function PaymentsCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-5 w-40 bg-surface-muted rounded mb-2" />
      <div className="h-4 w-64 bg-surface-muted rounded mb-6" />
      <div className="h-10 w-48 bg-surface-muted rounded" />
    </div>
  );
}

// ── State: Not connected ──────────────────────────────────────────────────────

function NotConnected({ onConnect, isConnecting }) {
  return (
    <div>
      <h2 className="text-heading text-ink-primary mb-1">Accept Payments</h2>
      <p className="text-body text-ink-secondary mb-6">
        Connect your Stripe account to receive client payments directly.
      </p>

      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
      >
        {isConnecting ? (
          <>
            <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Connecting…
          </>
        ) : (
          'Connect with Stripe'
        )}
      </button>

      <ul className="mt-5 space-y-2">
        {[
          'Funds deposited directly to your bank account',
          'Stripe handles PCI compliance and fraud protection',
          'No monthly fees — pay only when you earn',
        ].map(item => (
          <li key={item} className="flex items-start gap-2 text-body-sm text-ink-secondary">
            <IconCheck className="h-4 w-4 text-sage-500 flex-shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── State: Incomplete onboarding ──────────────────────────────────────────────

function IncompleteOnboarding({ accountId, onboardingUrl, onResume, isConnecting }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <IconWarning className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <h2 className="text-heading text-ink-primary">Setup Incomplete</h2>
      </div>
      <p className="text-body text-ink-secondary mb-1">
        Your Stripe account (<span className="font-mono text-body-sm text-ink-primary">{accountId}</span>) was created but onboarding isn't finished yet.
      </p>
      <p className="text-body-sm text-ink-tertiary mb-6">
        Complete the setup so Stripe can verify your identity and enable payouts.
      </p>

      <a
        href={onboardingUrl}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        Complete Stripe Setup
        <IconExternalLink className="h-4 w-4" />
      </a>

      <button
        onClick={onResume}
        disabled={isConnecting}
        className="ml-3 text-body-sm text-ink-secondary underline underline-offset-2 hover:text-ink-primary transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 rounded"
      >
        {isConnecting ? 'Refreshing…' : 'Get a new link'}
      </button>
    </div>
  );
}

// ── State: Connected ──────────────────────────────────────────────────────────

function Connected({ status }) {
  const { accountId, chargesEnabled, payoutsEnabled, connectedAt } = status;
  const last4 = accountId?.slice(-4) ?? '????';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-heading text-ink-primary">Payments</h2>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label font-medium bg-success-50 text-success-700 border border-success-200">
          <IconCheck className="h-3 w-3" />
          Connected
        </span>
      </div>

      <dl className="space-y-2 mb-6">
        <div className="flex gap-4">
          <dt className="text-body-sm text-ink-tertiary w-32 flex-shrink-0">Account</dt>
          <dd className="text-body-sm text-ink-primary font-mono">acct_···{last4}</dd>
        </div>
        <div className="flex gap-4">
          <dt className="text-body-sm text-ink-tertiary w-32 flex-shrink-0">Charges</dt>
          <dd className="flex items-center gap-1.5 text-body-sm">
            {chargesEnabled ? (
              <><IconCheck className="h-3.5 w-3.5 text-success-600" /><span className="text-success-700">Enabled</span></>
            ) : (
              <span className="text-amber-600">Pending verification</span>
            )}
          </dd>
        </div>
        <div className="flex gap-4">
          <dt className="text-body-sm text-ink-tertiary w-32 flex-shrink-0">Payouts</dt>
          <dd className="flex items-center gap-1.5 text-body-sm">
            {payoutsEnabled ? (
              <><IconCheck className="h-3.5 w-3.5 text-success-600" /><span className="text-success-700">Enabled</span></>
            ) : (
              <span className="text-amber-600">Pending verification</span>
            )}
          </dd>
        </div>
        {connectedAt && (
          <div className="flex gap-4">
            <dt className="text-body-sm text-ink-tertiary w-32 flex-shrink-0">Connected</dt>
            <dd className="text-body-sm text-ink-secondary">
              {new Date(connectedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </dd>
          </div>
        )}
      </dl>

      <a
        href="https://dashboard.stripe.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover rounded-button text-body-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1"
      >
        Open Stripe Dashboard
        <IconExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

const RATE_TYPES = [
  { value: 'hour', label: 'per hour' },
  { value: 'project', label: 'per project' },
  { value: 'day', label: 'per day' },
];

function ProfileSection({ profile, originalProfile, onChange, onSave, saving }) {
  const hasChanges =
    profile.business_name !== originalProfile.business_name ||
    profile.typical_services !== originalProfile.typical_services ||
    profile.default_rate !== originalProfile.default_rate ||
    profile.rate_type !== originalProfile.rate_type;

  return (
    <div className="space-y-4">
      {/* Business name */}
      <Input
        label="Business name"
        type="text"
        value={profile.business_name}
        onChange={e => onChange('business_name', e.target.value)}
        placeholder="Your business name"
      />

      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <label className="block text-label uppercase tracking-wider text-ink-secondary">Email</label>
        <p className="px-3.5 py-2.5 text-body text-ink-secondary bg-surface-muted border border-surface-border rounded-input">
          {profile.email || '—'}
        </p>
      </div>

      {/* Services */}
      <TextArea
        label="Services"
        value={profile.typical_services}
        onChange={e => onChange('typical_services', e.target.value)}
        placeholder="e.g. Web design, Brand identity, SEO"
        rows={3}
      />

      {/* Default rate */}
      <div className="space-y-1.5">
        <label className="block text-label uppercase tracking-wider text-ink-secondary">Default rate</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary text-body pointer-events-none">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={profile.default_rate}
            onChange={e => onChange('default_rate', e.target.value)}
            placeholder="0"
            className="w-full pl-7 pr-3.5 py-2.5 bg-surface-card border border-surface-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary transition-all duration-150 focus:outline-none focus:ring-1 focus:border-sage-500 focus:ring-sage-500/20"
          />
        </div>
      </div>

      {/* Rate type pill toggle */}
      <div className="space-y-1.5">
        <label className="block text-label uppercase tracking-wider text-ink-secondary">Rate type</label>
        <div className="inline-flex rounded-input border border-surface-border overflow-hidden">
          {RATE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange('rate_type', value)}
              className={[
                'px-4 py-2 text-body-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset',
                profile.rate_type === value
                  ? 'bg-sage-500 text-ink-inverse'
                  : 'bg-surface-card text-ink-secondary hover:bg-surface-hover',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="pt-1">
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          {saving ? (
            <>
              <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Saving…
            </>
          ) : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ── Subscription section ──────────────────────────────────────────────────────

function SubscriptionSection({ billing, billingLoading, onPortal, portalLoading }) {
  const navigate = useNavigate();

  if (billingLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-48 bg-surface-muted rounded" />
        <div className="h-4 w-32 bg-surface-muted rounded" />
        <div className="h-9 w-36 bg-surface-muted rounded mt-4" />
      </div>
    );
  }

  const status = billing?.subscription_status;
  const plan = billing?.subscription_plan;
  const period = billing?.subscription_period;
  const trialEnd = billing?.trial_end_date;
  const isActive = status === 'active';
  const isTrialing = status === 'trialing';
  const isExpired = billing?.access?.reason === 'trial_expired';
  const isPastDue = status === 'past_due';

  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : null;
  const periodLabel = period === 'annual' ? 'Annual' : 'Monthly';

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isTrialing) {
    return (
      <div>
        <dl className="space-y-1.5 mb-5">
          <div className="flex gap-4">
            <dt className="text-body-sm text-ink-tertiary w-36 flex-shrink-0">Current plan</dt>
            <dd className="text-body-sm text-ink-primary font-medium">Pro (Trial)</dd>
          </div>
          <div className="flex gap-4">
            <dt className="text-body-sm text-ink-tertiary w-36 flex-shrink-0">Trial ends</dt>
            <dd className="text-body-sm text-ink-primary">{formatDate(trialEnd)}</dd>
          </div>
          {billing?.trial_days_remaining != null && (
            <div className="flex gap-4">
              <dt className="text-body-sm text-ink-tertiary w-36 flex-shrink-0">Days remaining</dt>
              <dd className="text-body-sm text-ink-primary">{billing.trial_days_remaining}</dd>
            </div>
          )}
        </dl>
        <button
          onClick={() => navigate('/app/pricing')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-medium text-body-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          Choose a plan
        </button>
      </div>
    );
  }

  if (isActive) {
    return (
      <div>
        <dl className="space-y-1.5 mb-5">
          <div className="flex gap-4">
            <dt className="text-body-sm text-ink-tertiary w-36 flex-shrink-0">Current plan</dt>
            <dd className="text-body-sm text-ink-primary font-medium">
              {planLabel || 'Pro'} ({periodLabel})
              {isPastDue && (
                <span className="ml-2 text-label text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Payment due</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onPortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover rounded-button text-body-sm transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1"
          >
            {portalLoading ? (
              <><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />Opening…</>
            ) : 'Manage subscription'}
          </button>
          <button
            onClick={() => navigate('/app/pricing')}
            className="text-body-sm text-ink-secondary underline underline-offset-2 hover:text-ink-primary transition-colors focus-visible:outline-none"
          >
            Change plan
          </button>
        </div>
      </div>
    );
  }

  // Expired / canceled / none
  return (
    <div>
      <p className="text-body-sm text-ink-secondary mb-4">
        {isExpired ? 'Your free trial has ended.' : 'No active subscription.'}
      </p>
      <button
        onClick={() => navigate('/app/pricing')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-semibold text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
      >
        Choose a plan
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_PROFILE = { business_name: '', email: '', typical_services: '', default_rate: '', rate_type: 'hour' };

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusLoading, setStatusLoading] = useState(true);
  const [connectStatus, setConnectStatus] = useState(null);  // null = not yet loaded
  const [isConnecting, setIsConnecting] = useState(false);
  const [toast, setToast] = useState(null);  // { message, type }

  // Billing state
  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Profile state
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState(EMPTY_PROFILE);
  const [profileSaving, setProfileSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.getProfile();
      const p = {
        business_name: data.business_name || '',
        email: data.email || '',
        typical_services: data.typical_services || '',
        default_rate: data.default_rate != null ? String(data.default_rate) : '',
        rate_type: data.rate_type || 'hour',
      };
      setProfile(p);
      setOriginalProfile(p);
    } catch {
      // profile load failure is non-critical
    }
  }, []);

  useEffect(() => {
    document.title = 'Settings — ScatterPilot';
    api.getBillingStatus().then(setBilling).catch(() => {}).finally(() => setBillingLoading(false));
    loadProfile();
  }, [loadProfile]);

  const handleProfileChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await api.updateProfile({
        business_name: profile.business_name,
        typical_services: profile.typical_services,
        default_rate: profile.default_rate !== '' ? parseFloat(profile.default_rate) : null,
        rate_type: profile.rate_type,
      });
      setOriginalProfile(profile);
      setToast({ message: 'Profile updated', type: 'success' });
    } catch {
      setToast({ message: 'Could not save profile. Please try again.', type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogOut = async () => {
    await authService.signOut();
    navigate('/');
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await api.createBillingPortal();
      window.location.href = url;
    } catch {
      setToast({ message: 'Could not open billing portal. Please try again.', type: 'error' });
      setPortalLoading(false);
    }
  };

  const dismissToast = useCallback(() => setToast(null), []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await api.getConnectStatus();
      setConnectStatus(data);
    } catch {
      setConnectStatus({ connected: false });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Initial load + URL param handling
  useEffect(() => {
    const onboardingComplete = searchParams.get('onboarding') === 'complete';
    const needsRefresh = searchParams.get('refresh') === 'true';

    if (onboardingComplete) {
      setToast({ message: 'Stripe account connected successfully!', type: 'success' });
      // Clear params from URL without navigation
      setSearchParams({}, { replace: true });
    }

    loadStatus().then(() => {
      if (needsRefresh && !onboardingComplete) {
        // Auto-trigger reconnect
        handleConnect();
        setSearchParams({}, { replace: true });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const data = await api.createConnectAccount();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setToast({ message: 'Could not start Stripe setup. Please try again.', type: 'error' });
      setIsConnecting(false);
    }
  };

  const renderPaymentsContent = () => {
    if (statusLoading) return <PaymentsCardSkeleton />;

    if (!connectStatus?.connected) {
      return <NotConnected onConnect={handleConnect} isConnecting={isConnecting} />;
    }

    if (!connectStatus.detailsSubmitted) {
      return (
        <IncompleteOnboarding
          accountId={connectStatus.accountId}
          onboardingUrl={connectStatus.onboardingUrl}
          onResume={handleConnect}
          isConnecting={isConnecting}
        />
      );
    }

    return <Connected status={connectStatus} />;
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />
      )}

      <h1 className="text-title text-ink-primary mb-6">Settings</h1>

      {/* Profile card */}
      <section className="bg-surface-card border border-surface-border rounded-card p-6 mb-5">
        <p className="text-label uppercase tracking-widest text-ink-tertiary font-medium mb-4">Profile</p>
        <ProfileSection
          profile={profile}
          originalProfile={originalProfile}
          onChange={handleProfileChange}
          onSave={handleProfileSave}
          saving={profileSaving}
        />
      </section>

      {/* Subscription card */}
      <section className="bg-surface-card border border-surface-border rounded-card p-6 mb-5">
        <p className="text-label uppercase tracking-widest text-ink-tertiary font-medium mb-4">Subscription</p>
        <SubscriptionSection
          billing={billing}
          billingLoading={billingLoading}
          onPortal={handlePortal}
          portalLoading={portalLoading}
        />
      </section>

      {/* Payments card */}
      <section className="bg-surface-card border border-surface-border rounded-card p-6 mb-5">
        <p className="text-label uppercase tracking-widest text-ink-tertiary font-medium mb-4">Payments</p>
        {renderPaymentsContent()}
      </section>

      {/* Log out */}
      <button
        onClick={handleLogOut}
        className="w-full py-3 text-body font-medium text-danger-400 text-center hover:text-danger-500 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-400 focus-visible:ring-offset-2 rounded"
      >
        Log out
      </button>
    </div>
  );
}
