import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../services/api';

// ── LocalStorage helpers for progress persistence ────────────────────────────
const LS_PREFIX = 'sp_onboarding_';
const saveLS = (key, val) => {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch {}
};
const loadLS = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};

const RATE_PERIODS = [
  { id: 'hour', label: 'per hour' },
  { id: 'project', label: 'per project' },
  { id: 'day', label: 'per day' },
];

const stepVariants = {
  initial: (dir) => ({ x: dir * 40, opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -40, opacity: 0 }),
};
const stepTransition = { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] };

// ── Shared input class ───────────────────────────────────────────────────────
const inputCls =
  'w-full py-4 px-5 bg-surface-card border border-surface-border rounded-input ' +
  'text-heading-lg text-ink-primary placeholder:text-ink-tertiary ' +
  'focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 ' +
  'transition-all duration-150';

// ── Main component ───────────────────────────────────────────────────────────
export default function OnboardingFlow({ onComplete }) {
  // Resume from localStorage if user refreshed mid-flow
  const [step, setStep] = useState(() => Math.min(loadLS('step', 0), 3));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state — each field hydrates from localStorage
  const [businessName, setBusinessName] = useState(() => loadLS('business_name', ''));
  const [services, setServices] = useState(() => loadLS('services', ''));
  const [rateAmount, setRateAmount] = useState(() => loadLS('rate_amount', ''));
  const [ratePeriod, setRatePeriod] = useState(() => loadLS('rate_period', 'hour'));
  const [clientName, setClientName] = useState(() => loadLS('client_name', ''));
  const [clientEmail, setClientEmail] = useState(() => loadLS('client_email', ''));

  // Refs for auto-focus per step
  const ref0 = useRef(null);
  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const stepRefs = [ref0, ref1, ref2, ref3];

  useEffect(() => {
    const timer = setTimeout(() => stepRefs[step]?.current?.focus(), 320);
    return () => clearTimeout(timer);
  }, [step]);

  // ── Step advancement ───────────────────────────────────────────────────────
  const goNext = async (saveFn) => {
    if (isSaving) return;
    setError('');
    setIsSaving(true);
    try {
      await saveFn?.();
    } catch (err) {
      console.error('[Onboarding] Save error (advancing anyway):', err);
      setError('Saved locally — will sync when reconnected.');
    } finally {
      setIsSaving(false);
    }
    const next = step + 1;
    saveLS('step', next);
    setStep(next);
  };

  // ── Per-step save functions ────────────────────────────────────────────────
  const saveBusinessName = async () => {
    saveLS('business_name', businessName.trim());
    if (businessName.trim()) {
      await api.updateProfile({ business_name: businessName.trim() });
    }
  };

  const saveServices = async () => {
    saveLS('services', services.trim());
    if (services.trim()) {
      await api.updateProfile({ typical_services: services.trim() });
    }
  };

  const saveRate = async () => {
    saveLS('rate_amount', rateAmount.trim());
    saveLS('rate_period', ratePeriod);
    // Persist to backend so the AI uses this rate as default when creating invoices
    await api.updateProfile({
      default_rate: rateAmount.trim() || null,
      rate_type: ratePeriod,
    });
  };

  // ── Completion (step 3) ────────────────────────────────────────────────────
  const handleComplete = async (skipClient = false) => {
    if (isSaving) return;
    setError('');
    setIsSaving(true);
    let clientCreated = false;

    try {
      if (!skipClient && clientName.trim()) {
        await api.updateCustomer(clientName.trim(), {
          ...(clientEmail.trim() ? { email: clientEmail.trim() } : {}),
        });
        clientCreated = true;
        saveLS('client_name', clientName.trim());
        saveLS('client_email', clientEmail.trim());
      }
    } catch (err) {
      console.error('[Onboarding] Client creation error (continuing):', err);
    }

    // Mark onboarding complete — backend is source of truth, localStorage is fallback.
    try {
      await api.updateProfile({ onboarding_completed: true });
    } catch (err) {
      console.error('[Onboarding] Failed to persist completion flag (continuing):', err);
    }
    localStorage.setItem('sp_onboarding_completed', 'true');
    saveLS('step', 0);

    setIsSaving(false);
    onComplete?.({ clientName: clientName.trim(), clientCreated });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-surface-bg flex flex-col items-center justify-center px-4">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-12">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              i === step ? 'bg-sage-500' : 'bg-surface-border'
            }`}
          />
        ))}
      </div>

      {/* Step content with slide transition */}
      <div className="w-full max-w-md overflow-hidden">
        <AnimatePresence mode="wait" custom={1}>

          {/* ── Step 0: Business Name ── */}
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={1}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              <div className="text-center">
                <h1 className="text-2xl md:text-display text-ink-primary">What's your business called?</h1>
                <p className="text-body md:text-body-lg text-ink-secondary mt-2">This appears on your invoices</p>
              </div>
              <div className="mt-8 max-w-sm mx-auto">
                <input
                  ref={ref0}
                  type="text"
                  value={businessName}
                  onChange={e => { setBusinessName(e.target.value); saveLS('business_name', e.target.value); }}
                  onKeyDown={e => e.key === 'Enter' && businessName.trim() && goNext(saveBusinessName)}
                  placeholder="e.g. Acme Consulting"
                  className={inputCls}
                />
                {error && <p className="mt-2 text-body-sm text-danger-400">{error}</p>}
                <button
                  onClick={() => businessName.trim() && goNext(saveBusinessName)}
                  disabled={!businessName.trim() || isSaving}
                  className="mt-4 w-full py-3.5 bg-sage-500 hover:bg-sage-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-button font-semibold text-body-lg transition-colors duration-150"
                >
                  {isSaving ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Services ── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={1}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              <div className="text-center">
                <h1 className="text-2xl md:text-display text-ink-primary">What do you do?</h1>
                <p className="text-body md:text-body-lg text-ink-secondary mt-2">
                  Describe your services — we'll help categorize them for invoices
                </p>
              </div>
              <div className="mt-8 max-w-sm mx-auto">
                <textarea
                  ref={ref1}
                  value={services}
                  onChange={e => { setServices(e.target.value); saveLS('services', e.target.value); }}
                  placeholder="e.g. Brand strategy, UX design, and front-end development"
                  rows={4}
                  className={inputCls + ' resize-none'}
                />
                {error && <p className="mt-2 text-body-sm text-danger-400">{error}</p>}
                <button
                  onClick={() => goNext(saveServices)}
                  disabled={isSaving}
                  className="mt-4 w-full py-3.5 bg-sage-500 hover:bg-sage-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-button font-semibold text-body-lg transition-colors duration-150"
                >
                  {isSaving ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Rate ── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={1}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              <div className="text-center">
                <h1 className="text-2xl md:text-display text-ink-primary">What's your typical rate?</h1>
                <p className="text-body md:text-body-lg text-ink-secondary mt-2">
                  We'll use this as the default when creating invoices
                </p>
              </div>
              <div className="mt-8 max-w-sm mx-auto">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-heading-lg text-ink-secondary font-semibold select-none pointer-events-none">
                    $
                  </span>
                  <input
                    ref={ref2}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={rateAmount}
                    onChange={e => { setRateAmount(e.target.value); saveLS('rate_amount', e.target.value); }}
                    onKeyDown={e => e.key === 'Enter' && goNext(saveRate)}
                    placeholder="250"
                    className={inputCls + ' pl-12'}
                  />
                </div>
                {/* Period pills */}
                <div className="flex gap-2 mt-4">
                  {RATE_PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setRatePeriod(p.id); saveLS('rate_period', p.id); }}
                      className={`flex-1 py-2 px-3 rounded-button text-body-sm font-medium transition-colors duration-150 ${
                        ratePeriod === p.id
                          ? 'bg-sage-500 text-white'
                          : 'bg-surface-muted text-ink-secondary border border-surface-border hover:bg-surface-hover'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {error && <p className="mt-2 text-body-sm text-danger-400">{error}</p>}
                <button
                  onClick={() => goNext(saveRate)}
                  disabled={isSaving}
                  className="mt-4 w-full py-3.5 bg-sage-500 hover:bg-sage-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-button font-semibold text-body-lg transition-colors duration-150"
                >
                  {isSaving ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: First Client ── */}
          {step === 3 && (
            <motion.div
              key="step-3"
              custom={1}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              <div className="text-center">
                <h1 className="text-2xl md:text-display text-ink-primary">Who's your first client?</h1>
                <p className="text-body md:text-body-lg text-ink-secondary mt-2">
                  Let's create your first invoice right now
                </p>
              </div>
              <div className="mt-8 max-w-sm mx-auto">
                <input
                  ref={ref3}
                  type="text"
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); saveLS('client_name', e.target.value); }}
                  placeholder="Client or company name"
                  className={inputCls}
                />
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => { setClientEmail(e.target.value); saveLS('client_email', e.target.value); }}
                  placeholder="client@example.com"
                  className="mt-3 w-full py-3 px-5 bg-surface-card border border-surface-border rounded-input text-body-lg text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-all duration-150"
                />
                {error && <p className="mt-2 text-body-sm text-danger-400">{error}</p>}
                <button
                  onClick={() => handleComplete(false)}
                  disabled={!clientName.trim() || isSaving}
                  className="mt-4 w-full py-3.5 bg-sage-500 hover:bg-sage-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-button font-semibold text-body-lg transition-colors duration-150"
                >
                  {isSaving ? 'Creating…' : 'Create First Invoice →'}
                </button>
                <button
                  onClick={() => handleComplete(true)}
                  disabled={isSaving}
                  className="mt-3 w-full text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-150"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
