import { useState } from 'react';
import authService from '../services/auth';

export default function VerifyEmail({ email, onVerificationSuccess, onBackToSignup }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      setError('Verification code must be 6 digits');
      setLoading(false);
      return;
    }

    try {
      await authService.confirmRegistration(email, code);
      onVerificationSuccess();
    } catch (err) {
      console.error('Verification error:', err);

      // Handle different error types
      let errorMessage = 'Verification failed. Please try again.';

      if (err.code === 'CodeMismatchException') {
        errorMessage = 'Invalid verification code. Please check and try again.';
      } else if (err.code === 'ExpiredCodeException') {
        errorMessage = 'Verification code has expired. Please request a new code.';
      } else if (err.code === 'NotAuthorizedException') {
        errorMessage = 'User is already confirmed. Please try logging in.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setResendSuccess(false);
    setResendLoading(true);

    try {
      await authService.resendConfirmationCode(email);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      console.error('Resend code error:', err);

      let errorMessage = 'Failed to resend code. Please try again.';

      if (err.code === 'LimitExceededException') {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (err.code === 'InvalidParameterException') {
        errorMessage = 'User is already confirmed. Please try logging in.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    // Only allow digits and limit to 6 characters
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-xl border border-gray-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Verify your email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a verification code to
          </p>
          <p className="mt-1 text-center text-sm font-medium text-gray-900">
            {email}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-950/30 border border-red-700/50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-300">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}

          {resendSuccess && (
            <div className="rounded-md bg-green-950/30 border border-green-700/50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-300">
                    Verification code sent! Check your email.
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Verification Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              required
              value={code}
              onChange={handleCodeChange}
              className="mt-1 appearance-none relative block w-full px-3 py-2 bg-gray-100 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-gray-600">
              Enter the 6-digit code from your email
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-brand hover:bg-gradient-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendLoading}
              className="text-purple-400 hover:text-purple-300 font-medium disabled:opacity-50"
            >
              {resendLoading ? 'Sending...' : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={onBackToSignup}
              className="text-gray-600 hover:text-gray-500"
            >
              Back to signup
            </button>
          </div>
        </form>

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-600">
                Didn't receive the code?
              </span>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-gray-600">
            <p>Check your spam folder or click "Resend code"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
