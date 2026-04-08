import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

const STEPS = ['intro', 'saving', 'done'];

export default function OnboardingOverlay({ onComplete }) {
  const [step, setStep] = useState('intro');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setStep('saving');
    setError('');
    try {
      // Try to extract a business name heuristically (first proper noun before comma/period)
      const businessName = extractBusinessName(text);
      await api.updateProfile({
        ...(businessName ? { business_name: businessName } : {}),
        typical_services: text.trim(),
      });
      setStep('done');
      // Auto-advance after brief confirmation
      setTimeout(() => onComplete?.(), 1200);
    } catch (err) {
      console.error('Failed to save onboarding profile:', err);
      setError('Something went wrong saving your info. You can skip for now.');
      setStep('intro');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream px-4">
      <AnimatePresence mode="wait">

        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg text-center space-y-8"
          >
            {/* Logo mark */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-sage flex items-center justify-center shadow-light-md">
                <SparklesIcon className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-navy">Welcome to ScatterPilot</h1>
              <p className="text-base text-navy-light">
                Tell us about your business so we can personalise your invoices.
              </p>
            </div>

            <div className="space-y-3 text-left">
              <label className="block text-sm font-medium text-navy">
                What does your business do?
              </label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="e.g. I'm a freelance web designer specialising in Shopify stores for e-commerce brands"
                rows={4}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-navy placeholder-navy-muted focus:outline-none focus:ring-2 focus:ring-sage focus:border-sage resize-none text-base transition-all duration-150"
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
              />
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="w-full py-3.5 bg-navy hover:bg-navy/90 text-white rounded-xl font-semibold text-base shadow-light-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Get started
              </motion.button>
              <button
                onClick={() => onComplete?.()}
                className="text-sm text-navy-muted hover:text-navy transition-colors duration-150"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        )}

        {step === 'saving' && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-4"
          >
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-sage border-t-transparent" />
            <p className="text-navy-light text-sm">Saving your profile…</p>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-navy">You're all set!</h2>
            <p className="text-navy-light text-sm">Let's create your first invoice.</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

function extractBusinessName(text) {
  // Very simple heuristic: look for "I'm [Name]" or "My business is [Name]" or "[Name] is a"
  const patterns = [
    /I(?:'m| am) ([A-Z][a-zA-Z\s]{2,30}?)(?:,|\.|\s+and|\s+based|\s+specializ|\s+who)/,
    /(?:my (?:company|business|studio|agency|firm) (?:is |called |named )?)([\w\s]{2,30}?)(?:,|\.|\s+and|\s+-)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}
