import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiService from '../services/api';
import analytics from '../utils/analytics';

export default function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Poll subscription status until Pro or timeout
    let attempts = 0;
    const maxAttempts = 5;

    const pollSubscription = async () => {
      try {
        const sub = await apiService.getSubscription();
        setSubscription(sub);

        // Track successful checkout if user is now Pro
        if (sub?.subscription_status === 'pro') {
          const sessionId = searchParams.get('session_id');
          analytics.trackCheckoutCompleted(sessionId || 'unknown');
          setLoading(false);
          startCountdown();
          return;
        }

        // If not Pro yet and haven't exceeded max attempts, retry
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollSubscription, 2000);
        } else {
          // Give up after max attempts, but still show success
          setLoading(false);
          startCountdown();
        }
      } catch (err) {
        console.error('Failed to load subscription:', err);
        setLoading(false);
      }
    };

    // Start polling after 2 seconds
    const timer = setTimeout(() => {
      pollSubscription();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const startCountdown = () => {
    // Countdown from 5 to 0, then redirect
    let counter = 5;
    const interval = setInterval(() => {
      counter--;
      setCountdown(counter);
      if (counter <= 0) {
        clearInterval(interval);
        navigate('/app');
      }
    }, 1000);
  };

  const isPro = subscription?.subscription_status === 'pro';

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface-card rounded-card shadow-modal border border-surface-border p-8 text-center">
        {loading ? (
          <>
            <div className="w-12 h-12 rounded-full border-2 border-sage-200 border-t-sage-500 animate-spin mx-auto mb-6"></div>
            <h1 className="text-heading font-bold text-ink-primary mb-2">
              Processing your subscription…
            </h1>
            <p className="text-body text-ink-secondary">
              Please wait while we confirm your payment.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-heading-lg font-bold text-ink-primary mb-2">
              {isPro ? 'Welcome to Pro!' : 'Thank you!'}
            </h1>

            <p className="text-body text-ink-secondary mb-6">
              {isPro
                ? 'Your subscription is now active. You have unlimited access to create invoices.'
                : 'Your payment is being processed. This may take a moment.'}
            </p>

            {isPro && (
              <>
                <div className="bg-sage-50 rounded-card p-4 mb-4 text-left">
                  <h3 className="text-body font-semibold text-ink-primary mb-2">What's included:</h3>
                  <ul className="text-body-sm text-ink-secondary space-y-1">
                    <li>Unlimited invoices</li>
                    <li>Priority support</li>
                    <li>All future features</li>
                  </ul>
                </div>

                <div className="bg-surface-bg rounded-card p-4 mb-6">
                  <p className="text-body-sm text-ink-secondary">
                    Redirecting to your app in <span className="font-bold text-sage-500">{countdown}</span> seconds…
                  </p>
                </div>
              </>
            )}

            <div className="space-y-3">
              <button
                onClick={() => navigate('/app')}
                className="w-full py-2.5 px-4 bg-sage-500 hover:bg-sage-600 text-white rounded-button font-semibold transition-colors"
              >
                {isPro ? 'Go to App Now' : 'Start Creating Invoices'}
              </button>

              <button
                onClick={() => navigate('/account')}
                className="w-full py-2.5 px-4 border border-surface-border-strong text-ink-primary rounded-button font-medium hover:bg-surface-bg transition-colors"
              >
                View Account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
