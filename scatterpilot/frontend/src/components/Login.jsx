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

// ── Reusable field components ─────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-body-sm font-medium text-ink-primary mb-1.5">
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={[
        'w-full px-3 py-2.5 border border-surface-border rounded-input bg-white',
        'text-body text-ink-primary placeholder:text-ink-tertiary',
        'focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20',
        'transition-all duration-150',
        props.className || '',
      ].join(' ')}
    />
  );
}

function PrimaryButton({ loading, loadingText, children, disabled, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {loadingText}
        </>
      ) : children}
    </button>
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

export default function Login({ onLoginSuccess, onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');

  // Reset password state (after receiving code)
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.signIn(email, password);
      onLoginSuccess();
    } catch (err) {
      console.error('Login error:', err);

      let errorMessage = 'Login failed. Please try again.';

      if (err.code === 'UserNotFoundException') {
        errorMessage = 'No account found with this email.';
      } else if (err.code === 'NotAuthorizedException') {
        errorMessage = 'Incorrect email or password.';
      } else if (err.code === 'UserNotConfirmedException') {
        errorMessage = 'Please verify your email before logging in.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotPasswordError('');
    setForgotPasswordLoading(true);

    try {
      await authService.forgotPassword(forgotPasswordEmail);
      setForgotPasswordSuccess(true);
      setShowForgotPassword(false);
      setShowResetPassword(true);
    } catch (err) {
      console.error('Forgot password error:', err);

      let errorMessage = 'Failed to send reset code. Please try again.';

      if (err.code === 'UserNotFoundException') {
        errorMessage = 'No account found with this email.';
      } else if (err.code === 'LimitExceededException') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setForgotPasswordError(errorMessage);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }

    setResetLoading(true);

    try {
      await authService.confirmForgotPassword(forgotPasswordEmail, resetCode, newPassword);
      setResetSuccess(true);
      setTimeout(() => {
        setShowResetPassword(false);
        setResetSuccess(false);
        setForgotPasswordSuccess(false);
        setEmail(forgotPasswordEmail);
        setPassword('');
        setForgotPasswordEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);

      let errorMessage = 'Failed to reset password. Please try again.';

      if (err.code === 'CodeMismatchException') {
        errorMessage = 'Invalid verification code.';
      } else if (err.code === 'ExpiredCodeException') {
        errorMessage = 'Verification code has expired. Please request a new one.';
      } else if (err.code === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet requirements. Must include uppercase, lowercase, number, and special character.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setResetError(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setShowResetPassword(false);
    setForgotPasswordSuccess(false);
    setResetSuccess(false);
    setForgotPasswordError('');
    setResetError('');
  };

  // ── Reset Password view ───────────────────────────────────────────────────

  if (showResetPassword) {
    return (
      <AuthShell>
        <h2 className="text-heading-lg text-ink-primary mb-1">Set new password</h2>
        <p className="text-body text-ink-secondary mb-6">
          Enter the code sent to <span className="font-medium text-ink-primary">{forgotPasswordEmail}</span>
        </p>

        {resetSuccess ? (
          <SuccessAlert message="Password reset successful! Redirecting to login…" />
        ) : (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <ErrorAlert message={resetError} />

            <div>
              <FieldLabel htmlFor="resetCode">Verification code</FieldLabel>
              <Input
                id="resetCode"
                name="resetCode"
                type="text"
                required
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="text-center tracking-widest text-heading-sm py-4"
              />
            </div>

            <div>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              <p className="mt-1.5 text-body-sm text-ink-tertiary">
                8+ characters with uppercase, lowercase, number, and special character
              </p>
            </div>

            <PrimaryButton type="submit" loading={resetLoading} loadingText="Resetting password…">
              Reset password
            </PrimaryButton>

            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-150"
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        )}
      </AuthShell>
    );
  }

  // ── Forgot Password view ──────────────────────────────────────────────────

  if (showForgotPassword) {
    return (
      <AuthShell>
        <h2 className="text-heading-lg text-ink-primary mb-1">Reset your password</h2>
        <p className="text-body text-ink-secondary mb-6">
          Enter your email and we'll send you a reset code.
        </p>

        <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
          <ErrorAlert message={forgotPasswordError} />

          <div>
            <FieldLabel htmlFor="forgotEmail">Email address</FieldLabel>
            <Input
              id="forgotEmail"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <PrimaryButton type="submit" loading={forgotPasswordLoading} loadingText="Sending code…">
            Send reset code
          </PrimaryButton>

          <div className="text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-150"
            >
              ← Back to sign in
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // ── Sign In view (default) ────────────────────────────────────────────────

  return (
    <AuthShell>
      <h2 className="text-heading-lg text-ink-primary mb-1">Welcome back</h2>
      <p className="text-body text-ink-secondary mb-6">Sign in to your account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert message={error} />

        <div>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(true);
                setForgotPasswordEmail(email);
              }}
              className="text-body-sm text-sage-500 hover:text-sage-600 transition-colors duration-150"
            >
              Forgot password? →
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <PrimaryButton type="submit" loading={loading} loadingText="Signing in…">
          Sign in
        </PrimaryButton>

        <p className="text-center text-body-sm text-ink-secondary">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150"
          >
            Sign up
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
