import { useState } from 'react';
import authService from '../services/auth';

// ── Shared auth page shell ────────────────────────────────────────────────────

function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Wordmark */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-sage-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-ink-inverse font-bold text-sm" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>S</span>
        </div>
        <span className="font-semibold text-ink-primary text-heading-sm" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>ScatterPilot</span>
      </div>

      {/* Card */}
      <div className="max-w-md w-full bg-surface-card rounded-card shadow-modal border border-surface-border p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-body-sm text-ink-tertiary">© 2026 ScatterPilot</p>
    </div>
  );
}

function ErrorAlert({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-input bg-danger-50 border border-danger-200 px-4 py-3 text-body-sm text-danger-400">
      {message}
    </div>
  );
}

function SuccessAlert({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-input bg-success-50 border border-success-100 px-4 py-3 text-body-sm text-success-400">
      {message}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
    <AuthShell>
      {/* Envelope icon */}
      <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mb-5">
        <svg className="w-6 h-6 text-sage-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>

      <h2 className="text-heading-lg text-ink-primary mb-1">Verify your email</h2>
      <p className="text-body text-ink-secondary mb-1">
        We sent a verification code to
      </p>
      <p className="text-body font-medium text-ink-primary mb-6">{email}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert message={error} />
        <SuccessAlert message={resendSuccess ? 'Verification code sent! Check your email.' : null} />

        <div>
          <label htmlFor="code" className="block text-body-sm font-medium text-ink-primary mb-1.5">
            Verification code
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
            placeholder="000000"
            maxLength={6}
            autoComplete="off"
            className="w-full px-3 py-4 border border-surface-border rounded-input bg-white text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-all duration-150 text-center text-heading-lg tracking-widest"
          />
          <p className="mt-1.5 text-body-sm text-ink-tertiary">
            Enter the 6-digit code from your email
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Verifying…
            </>
          ) : 'Verify Email'}
        </button>

        <div className="flex items-center justify-between text-body-sm pt-1">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendLoading}
            className="text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendLoading ? 'Sending…' : 'Resend code'}
          </button>
          <button
            type="button"
            onClick={onBackToSignup}
            className="text-ink-tertiary hover:text-ink-secondary transition-colors duration-150"
          >
            Back to signup
          </button>
        </div>

        <div className="border-t border-surface-border pt-3 text-center">
          <p className="text-body-sm text-ink-tertiary">
            Didn't receive it? Check your spam folder or resend the code.
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
