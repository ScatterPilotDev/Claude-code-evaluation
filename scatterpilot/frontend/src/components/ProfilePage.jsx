/**
 * Profile page — /app/profile
 *
 * Editable user profile: business name, email (read-only), services,
 * default rate, and rate type. Also houses Log Out and the link to Settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import authService from '../services/auth';
import Input from './ui/Input';

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg = type === 'success'
    ? 'bg-success-50 border-success-200 text-success-700'
    : 'bg-danger-50 border-danger-200 text-danger-700';

  return (
    <div className={`fixed bottom-20 left-4 right-4 md:bottom-auto md:top-4 md:left-auto md:right-4 md:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-lg border text-body-sm shadow-md ${bg}`}>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="ml-1 text-inherit opacity-60 hover:opacity-100 focus-visible:outline-none">✕</button>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconSettings({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconChevronRight({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function IconLogOut({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RATE_TYPES = [
  { value: 'hour',    label: 'per hour' },
  { value: 'project', label: 'per project' },
  { value: 'day',     label: 'per day' },
];

const EMPTY_PROFILE = { business_name: '', email: '', typical_services: '', default_rate: '', rate_type: 'hour' };

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.getProfile();
      const p = {
        business_name:    data.business_name    || '',
        email:            data.email            || '',
        typical_services: data.typical_services || '',
        default_rate:     data.default_rate != null ? String(data.default_rate) : '',
        rate_type:        data.rate_type        || 'hour',
      };
      setProfile(p);
      setOriginalProfile(p);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    document.title = 'Profile — ScatterPilot';
    loadProfile();
  }, [loadProfile]);

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        business_name:    profile.business_name,
        typical_services: profile.typical_services,
        default_rate:     profile.default_rate !== '' ? parseFloat(profile.default_rate) : null,
        rate_type:        profile.rate_type,
      });
      setOriginalProfile(profile);
      setToast({ message: 'Profile updated', type: 'success' });
    } catch {
      setToast({ message: 'Could not save profile. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogOut = async () => {
    await authService.signOut();
    navigate('/');
  };

  const hasChanges =
    profile.business_name    !== originalProfile.business_name    ||
    profile.typical_services !== originalProfile.typical_services ||
    profile.default_rate     !== originalProfile.default_rate     ||
    profile.rate_type        !== originalProfile.rate_type;

  const initials = (profile.business_name || profile.email || 'U')[0].toUpperCase();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />
      )}

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-display font-bold text-ink-primary">Profile</h1>
        <p className="text-body-lg text-ink-secondary mt-1">Manage your business information</p>
      </div>

      {/* Profile card */}
      <section className="bg-surface-card border border-surface-border rounded-card shadow-card overflow-hidden mb-4">

        {/* Avatar section */}
        <div className="bg-gradient-to-b from-sage-50/60 to-transparent px-6 pt-6 pb-5 flex items-center gap-4 border-b border-surface-border">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-sage-600">{initials}</span>
          </div>
          <div>
            <p className="text-heading font-semibold text-ink-primary">{profile.business_name || 'Your Business'}</p>
            <p className="text-body-sm text-ink-secondary">{profile.email || '—'}</p>
          </div>
        </div>

        <div className="divide-y divide-surface-border">

          {/* Business Info */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-label uppercase tracking-wider text-ink-tertiary font-medium">Business Info</p>
            <Input
              label="Business name"
              type="text"
              value={profile.business_name}
              onChange={e => handleChange('business_name', e.target.value)}
              placeholder="Your business name"
            />
            <div className="space-y-1.5">
              <label className="block text-label uppercase tracking-wider text-ink-secondary">Email</label>
              <p className="px-3.5 py-2.5 text-body text-ink-secondary bg-surface-muted border border-surface-border rounded-input">
                {profile.email || '—'}
              </p>
            </div>
          </div>

          {/* Billing */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-label uppercase tracking-wider text-ink-tertiary font-medium">Billing</p>
            <div className="space-y-1.5">
              <label className="block text-label uppercase tracking-wider text-ink-secondary">Default rate</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary text-body pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={profile.default_rate}
                  onChange={e => handleChange('default_rate', e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3.5 py-2.5 bg-surface-card border border-surface-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary transition-all duration-150 focus:outline-none focus:ring-1 focus:border-sage-500 focus:ring-sage-500/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-label uppercase tracking-wider text-ink-secondary">Rate type</label>
              <div className="inline-flex rounded-input border border-surface-border overflow-hidden">
                {RATE_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleChange('rate_type', value)}
                    className={[
                      'px-4 py-2 text-body-sm font-medium transition-colors duration-150 focus-visible:outline-none',
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
          </div>

          {/* Services */}
          <div className="px-6 py-5 space-y-3">
            <div>
              <p className="text-label uppercase tracking-wider text-ink-tertiary font-medium">Services</p>
              <p className="text-body-sm text-ink-tertiary mt-0.5">Describe what you do — ScatterPilot uses this to create better invoices</p>
            </div>
            <textarea
              value={profile.typical_services}
              onChange={e => handleChange('typical_services', e.target.value)}
              placeholder="e.g. Web design, Brand identity, SEO"
              rows={3}
              className="w-full px-3.5 py-2.5 bg-surface-card border border-surface-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary resize-none transition-all duration-150 focus:outline-none focus:ring-1 focus:border-sage-500 focus:ring-sage-500/20"
            />
          </div>

          {/* Save button */}
          <div className="px-6 py-4">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="w-full py-3 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
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
      </section>

      {/* App Settings nav row */}
      <Link
        to="/app/settings"
        className="flex items-center gap-3 w-full px-4 py-3.5 bg-surface-card border border-surface-border rounded-card mb-3 hover:bg-surface-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
      >
        <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center flex-shrink-0">
          <IconSettings className="h-4 w-4 text-ink-secondary" />
        </div>
        <span className="text-body text-ink-primary flex-1">App Settings</span>
        <IconChevronRight className="h-4 w-4 text-ink-tertiary" />
      </Link>

      {/* Ghost logout */}
      <button
        onClick={handleLogOut}
        className="flex items-center justify-center gap-2 w-full py-2.5 border border-surface-border rounded-card text-body text-ink-secondary hover:bg-surface-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-border focus-visible:ring-offset-2"
      >
        <IconLogOut className="w-4 h-4" />
        Log out
      </button>
    </div>
  );
}
