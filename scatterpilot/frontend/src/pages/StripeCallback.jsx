import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiService from '../services/api';
import authService from '../services/auth';

export default function StripeCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connecting your Stripe account...');

  useEffect(() => {
    handleStripeCallback();
  }, []);

  const handleStripeCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        console.error('[StripeCallback] OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || 'Failed to connect Stripe account');
        setTimeout(() => navigate('/settings'), 3000);
        return;
      }

      if (!code) {
        console.error('[StripeCallback] Missing authorization code');
        setStatus('error');
        setMessage('Missing authorization code');
        setTimeout(() => navigate('/settings'), 3000);
        return;
      }

      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        console.error('[StripeCallback] User not authenticated');
        setStatus('error');
        setMessage('You must be logged in to connect Stripe');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      console.log('[StripeCallback] Processing OAuth callback with code:', code.substring(0, 10) + '...');

      const response = await apiService.connectStripeCallback(code, state);

      if (response.success && response.stripeAccountId) {
        console.log('[StripeCallback] Stripe connected successfully:', response.stripeAccountId);
        setStatus('success');
        setMessage('Stripe connected successfully!');
        setTimeout(() => navigate('/settings'), 2000);
      } else {
        throw new Error(response.error || 'Failed to connect Stripe');
      }
    } catch (error) {
      console.error('[StripeCallback] Error:', error);
      setStatus('error');
      setMessage(error.message || 'Something went wrong');
      setTimeout(() => navigate('/settings'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      <div className="bg-surface-card border border-surface-border rounded-card shadow-modal p-12 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="w-14 h-14 rounded-full border-2 border-sage-200 border-t-sage-500 animate-spin" />
            </div>
            <h2 className="text-heading text-ink-primary mb-2">{message}</h2>
            <p className="text-body-sm text-ink-tertiary">Please wait…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="w-14 h-14 rounded-full bg-success-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-heading text-ink-primary mb-2">{message}</h2>
            <p className="text-body-sm text-ink-tertiary">Redirecting to settings…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="w-14 h-14 rounded-full bg-danger-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
            </div>
            <h2 className="text-heading text-ink-primary mb-2">Connection failed</h2>
            <p className="text-body-sm text-ink-secondary mb-2">{message}</p>
            <p className="text-body-sm text-ink-tertiary">Redirecting to settings…</p>
          </>
        )}
      </div>
    </div>
  );
}
