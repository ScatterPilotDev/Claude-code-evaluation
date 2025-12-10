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
      // Get OAuth parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        console.error('[StripeCallback] OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || 'Failed to connect Stripe account');
        setTimeout(() => navigate('/settings'), 3000);
        return;
      }

      // Validate required parameters
      if (!code) {
        console.error('[StripeCallback] Missing authorization code');
        setStatus('error');
        setMessage('Missing authorization code');
        setTimeout(() => navigate('/settings'), 3000);
        return;
      }

      // Verify user is authenticated
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        console.error('[StripeCallback] User not authenticated');
        setStatus('error');
        setMessage('You must be logged in to connect Stripe');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      console.log('[StripeCallback] Processing OAuth callback with code:', code.substring(0, 10) + '...');

      // Call backend to exchange code for token
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="mb-6">
              <svg
                className="animate-spin h-16 w-16 mx-auto text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{message}</h2>
            <p className="text-gray-600">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{message}</h2>
            <p className="text-gray-600">Redirecting to settings...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Connection Failed</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to settings...</p>
          </>
        )}
      </div>
    </div>
  );
}
