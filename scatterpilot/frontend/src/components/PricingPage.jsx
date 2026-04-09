/**
 * Pricing page — /app/pricing
 *
 * Three-tier pricing (Solo / Pro / Agency), monthly/annual toggle,
 * FAQ accordion, Stripe Checkout redirect on CTA click.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ── Data ─────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: 29,
    annualMonthlyPrice: 24,
    annualPrice: 290,
    description: 'Everything you need to invoice independently.',
    features: [
      'Unlimited invoices',
      'Unlimited clients',
      'AI invoice creation',
      'Stripe payments',
      'Invoice PDF',
    ],
    featured: false,
    cta: 'Choose Solo',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    annualMonthlyPrice: 41,
    annualPrice: 490,
    description: 'Power tools for growing freelancers.',
    features: [
      'Everything in Solo, plus:',
      'Remove ScatterPilot branding',
      'Priority AI',
      'Reports & analytics',
      'Invoice templates',
    ],
    featured: true,
    cta: 'Choose Pro',
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 99,
    annualMonthlyPrice: 83,
    annualPrice: 990,
    description: 'For agencies and teams invoicing at scale.',
    features: [
      'Everything in Pro, plus:',
      'Team seats',
      'Client portal',
      'API access',
      'Custom integrations',
      'Dedicated support',
    ],
    featured: false,
    cta: 'Choose Agency',
  },
];

const FAQS = [
  {
    q: 'Can I change plans?',
    a: 'Yes. You can upgrade or downgrade at any time from Settings → Subscription. Changes take effect at the start of your next billing period.',
  },
  {
    q: 'What happens when my trial ends?',
    a: 'After 14 days your account switches to read-only mode — all your data is safe. Choose a plan to resume creating invoices and receiving payments.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. Your invoices, clients, and payment history are always accessible, even if your subscription lapses. We never delete your data.',
  },
];

// ── Small components ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-sage-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-surface-border last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left text-body text-ink-primary font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset rounded"
      >
        <span>{q}</span>
        <span className={`ml-4 flex-shrink-0 text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-4 text-body-sm text-ink-secondary leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PricingPage({ currentStatus = null }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('monthly');
  const [loadingPlan, setLoadingPlan] = useState(null); // plan id being loaded

  const handleChoosePlan = async (planId) => {
    setLoadingPlan(planId);
    try {
      const { url } = await api.createBillingCheckout(planId, period);
      window.location.href = url;
    } catch (err) {
      // Surface error inline — button re-enables
      console.error('[Pricing] checkout error:', err);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="py-8">
      {/* ── Header ── */}
      <div className="text-center mb-10">
        <h1 className="text-display text-ink-primary">Choose your plan</h1>
        <p className="mt-2 text-body-lg text-ink-secondary">
          14-day free trial on all plans. No credit card required.
        </p>
      </div>

      {/* ── Toggle ── */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <div className="inline-flex items-center bg-surface-muted border border-surface-border rounded-full p-1">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-1.5 rounded-full text-body-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 ${
              period === 'monthly'
                ? 'bg-surface-card text-ink-primary shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`px-4 py-1.5 rounded-full text-body-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 ${
              period === 'annual'
                ? 'bg-surface-card text-ink-primary shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            Annual
          </button>
        </div>
        {period === 'annual' && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-sage-50 text-sage-600 text-label font-semibold border border-sage-200">
            Save 17%
          </span>
        )}
      </div>

      {/* ── Plan cards ── */}
      <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const price = period === 'monthly' ? plan.monthlyPrice : plan.annualMonthlyPrice;
          const isLoading = loadingPlan === plan.id;
          const isAnyLoading = !!loadingPlan;

          return (
            <div
              key={plan.id}
              className={[
                'flex-1 bg-surface-card rounded-card p-6 flex flex-col',
                plan.featured
                  ? 'border-2 border-sage-500 shadow-lg scale-[1.02] relative'
                  : 'border border-surface-border',
              ].join(' ')}
            >
              {/* Most Popular badge */}
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sage-500 text-white text-label font-semibold">
                    ★ Most Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-4">
                <p className="text-label uppercase tracking-widest text-ink-tertiary font-medium mb-1">
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-display text-ink-primary">${price}</span>
                  <span className="text-body text-ink-secondary mb-1">/mo</span>
                </div>
                {period === 'annual' && (
                  <p className="text-body-sm text-ink-tertiary">
                    ${plan.annualPrice}/yr billed annually
                  </p>
                )}
                <p className="mt-2 text-body-sm text-ink-secondary">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className={`flex items-start gap-2 text-body-sm ${
                    feature.endsWith(':') ? 'text-ink-secondary font-medium mt-2' : 'text-ink-primary'
                  }`}>
                    {!feature.endsWith(':') && <CheckIcon />}
                    <span className={feature.endsWith(':') ? 'ml-6' : ''}>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={() => handleChoosePlan(plan.id)}
                disabled={isAnyLoading}
                className={[
                  'w-full py-3 rounded-button font-semibold text-body transition-colors duration-150',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sage-500',
                  'flex items-center justify-center gap-2',
                  plan.featured
                    ? 'bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse'
                    : 'border border-surface-border text-ink-primary hover:bg-surface-hover active:bg-surface-muted',
                ].join(' ')}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                    Redirecting…
                  </>
                ) : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Footer note ── */}
      <div className="text-center mt-10 space-y-1">
        <p className="text-body-sm text-ink-secondary">
          All plans include a 14-day free trial. Cancel anytime.
        </p>
        <p className="text-body-sm text-ink-tertiary">
          Questions?{' '}
          <a href="mailto:support@scatterpilot.com" className="underline underline-offset-2 hover:text-ink-secondary transition-colors">
            Email support@scatterpilot.com
          </a>
        </p>
      </div>

      {/* ── FAQ ── */}
      <div className="max-w-xl mx-auto mt-12">
        <h2 className="text-heading text-ink-primary mb-4 text-center">Frequently asked questions</h2>
        <div className="bg-surface-card border border-surface-border rounded-card px-6">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </div>
  );
}
