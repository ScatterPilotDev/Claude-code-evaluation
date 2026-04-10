import { useState } from 'react';
import authService from '../services/auth';
import Logo from './brand/Logo';

// ── Shared auth page shell ────────────────────────────────────────────────────

function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Wordmark */}
      <div className="mb-8">
        <Logo variant="wordmark" size="lg" />
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

export default function Signup({ onSignupSuccess, onSwitchToLogin, onNeedVerification }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validatePassword = () => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const passwordError = validatePassword();
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const result = await authService.signUp(email, password);
      setSuccess(true);

      if (!result.userConfirmed) {
        setTimeout(() => {
          onNeedVerification(email);
        }, 1500);
      } else {
        setTimeout(() => {
          onSignupSuccess(email, password);
        }, 1500);
      }
    } catch (err) {
      console.error('Signup error:', err);

      let errorMessage = 'Signup failed. Please try again.';

      if (err.code === 'UsernameExistsException') {
        errorMessage = 'An account with this email already exists.';
      } else if (err.code === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet requirements.';
      } else if (err.code === 'InvalidParameterException') {
        errorMessage = 'Please check your email and password format.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="text-heading-lg text-ink-primary mb-1">Create your account</h2>
      <p className="text-body text-ink-secondary mb-6">Start your 14-day free trial</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert message={error} />
        <SuccessAlert message={success ? 'Account created! Check your email for a verification code.' : null} />

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
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="mt-1.5 text-body-sm text-ink-tertiary">
            8+ characters with uppercase, lowercase, number, and special character
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <PrimaryButton type="submit" loading={loading} loadingText="Creating account…" disabled={success}>
          {success ? 'Account created!' : 'Create account'}
        </PrimaryButton>

        <p className="text-center text-body-sm text-ink-tertiary">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-sage-500 hover:text-sage-600 transition-colors duration-150">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-sage-500 hover:text-sage-600 transition-colors duration-150">Privacy Policy</a>
        </p>

        <p className="text-center text-body-sm text-ink-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150"
          >
            Sign in
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
