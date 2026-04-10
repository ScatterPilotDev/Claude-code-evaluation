/**
 * LandingPage — ScatterPilot marketing homepage.
 *
 * Design: sage design system (same tokens as in-app).
 * Animations: Intersection Observer fade-in (no heavy library).
 * Mockups: CSS/JSX components that replicate real UI.
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import analytics from '../utils/analytics';

// ── Scroll-triggered fade-in hook ─────────────────────────────────────────────

function useFadeIn(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FadeIn({ children, className = '', delay = 0 }) {
  const [ref, visible] = useFadeIn();
  return (
    <div
      ref={ref}
      className={[
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className,
      ].join(' ')}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
      <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75z"/>
      <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/>
    </svg>
  );
}

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconChevron({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`w-5 h-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Product mockup components ─────────────────────────────────────────────────

function BrowserFrame({ children, className = '' }) {
  return (
    <div className={`rounded-xl overflow-hidden border border-surface-border shadow-modal ${className}`}>
      {/* Browser chrome */}
      <div className="bg-surface-muted border-b border-surface-border px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger-300" />
          <div className="w-3 h-3 rounded-full bg-amber-300" />
          <div className="w-3 h-3 rounded-full bg-success-300" />
        </div>
        <div className="flex-1 bg-surface-card rounded border border-surface-border px-3 py-1 text-label text-ink-tertiary text-center">
          app.scatterpilot.com
        </div>
      </div>
      {children}
    </div>
  );
}

function DashboardMockup() {
  return (
    <BrowserFrame>
      <div className="flex" style={{ minHeight: '340px' }}>
        {/* Sidebar */}
        <div className="w-[140px] bg-surface-card border-r border-surface-border flex flex-col py-3 px-2 flex-shrink-0">
          <div className="px-2 mb-3">
            <span className="text-label uppercase tracking-widest text-ink-tertiary font-medium text-[10px]">ScatterPilot</span>
          </div>
          <div className="mb-3">
            <div className="w-full py-1.5 bg-sage-500 rounded text-ink-inverse text-[11px] font-medium text-center">+ New Invoice</div>
          </div>
          {[
            { label: 'Home', active: true },
            { label: 'Clients', active: false },
            { label: 'Invoices', active: false },
            { label: 'Reports', active: false },
          ].map(({ label, active }) => (
            <div key={label} className={`px-2 py-1.5 rounded text-[11px] mb-0.5 ${active ? 'bg-sage-50 text-sage-600 font-medium' : 'text-ink-secondary'}`}>
              {label}
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 bg-surface-bg p-4 overflow-hidden">
          <div className="mb-3">
            <div className="text-[13px] font-semibold text-ink-primary">Good morning, Alex</div>
            <div className="text-[11px] text-ink-tertiary">Here's your business at a glance</div>
          </div>
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "You're owed", value: '$12,400', color: 'text-ink-primary' },
              { label: 'Received this month', value: '$8,200', color: 'text-success-400' },
              { label: 'Overdue', value: '2 invoices', color: 'text-danger-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-card rounded border border-surface-border p-2.5">
                <div className="text-[10px] text-ink-tertiary mb-1">{label}</div>
                <div className={`text-[13px] font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
          {/* Recent activity */}
          <div className="bg-surface-card rounded border border-surface-border p-2.5">
            <div className="text-[10px] font-medium text-ink-secondary mb-2">Recent Activity</div>
            {[
              { client: 'Acme Corp', amount: '$4,800', status: 'paid', statusColor: 'text-success-400 bg-success-50' },
              { client: "Sarah's Studio", amount: '$1,200', status: 'sent', statusColor: 'text-amber-500 bg-amber-50' },
              { client: 'BlockCo', amount: '$6,400', status: 'draft', statusColor: 'text-ink-tertiary bg-surface-muted' },
            ].map(({ client, amount, status, statusColor }) => (
              <div key={client} className="flex items-center justify-between py-1 border-b border-surface-border last:border-0">
                <span className="text-[11px] text-ink-primary">{client}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-ink-primary">{amount}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor}`}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function ChatMockup() {
  return (
    <BrowserFrame>
      <div className="flex" style={{ minHeight: '300px' }}>
        {/* Sidebar */}
        <div className="w-[120px] bg-surface-card border-r border-surface-border flex flex-col py-3 px-2 flex-shrink-0">
          <div className="text-[10px] text-ink-tertiary uppercase tracking-wider mb-2 px-1">Conversations</div>
          {['Marcus Lee', 'Acme Corp', 'New'].map((name, i) => (
            <div key={name} className={`px-2 py-1.5 rounded text-[11px] mb-0.5 ${i === 0 ? 'bg-sage-50 text-sage-700 font-medium' : 'text-ink-secondary'}`}>
              {name}
            </div>
          ))}
        </div>
        {/* Chat area */}
        <div className="flex-1 bg-surface-bg p-3 flex flex-col gap-2.5 overflow-hidden">
          {/* User message */}
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-surface-muted border border-surface-border flex items-center justify-center text-[10px] text-ink-secondary flex-shrink-0">U</div>
            <div className="bg-surface-card border border-surface-border rounded-lg p-2.5 text-[11px] text-ink-primary max-w-[80%]">
              Invoice Marcus Lee for brand strategy consulting, 3 days at $1,500/day
            </div>
          </div>
          {/* AI message */}
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
              </svg>
            </div>
            <div className="flex-1 max-w-[85%]">
              <div className="bg-sage-50 border border-sage-200 rounded-lg p-2.5 text-[11px] text-ink-primary mb-1.5">
                Done! I've created your invoice for Marcus Lee.
              </div>
              <div className="bg-surface-card border border-surface-border rounded-lg p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Client</span>
                  <span className="font-medium text-ink-primary">Marcus Lee</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Service</span>
                  <span className="font-medium text-ink-primary">Brand Strategy</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Total</span>
                  <span className="font-bold text-ink-primary">$4,500.00</span>
                </div>
              </div>
              <button className="mt-1.5 w-full bg-sage-500 text-ink-inverse text-[11px] py-1.5 rounded font-medium">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function MetricsMockup() {
  return (
    <BrowserFrame>
      <div className="bg-surface-bg p-4" style={{ minHeight: '260px' }}>
        <div className="mb-3">
          <div className="text-[13px] font-semibold text-ink-primary">Dashboard</div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { label: "You're owed", value: '$24,800', sub: '4 outstanding invoices', color: 'text-ink-primary', bg: '' },
            { label: 'Received this month', value: '$18,500', sub: '+23% vs last month', color: 'text-success-400', bg: 'bg-success-50' },
            { label: 'Overdue', value: '$3,200', sub: '1 invoice past due', color: 'text-danger-400', bg: 'bg-danger-50' },
            { label: 'Avg. invoice size', value: '$6,200', sub: 'Last 30 days', color: 'text-ink-primary', bg: '' },
          ].map(({ label, value, sub, color, bg }) => (
            <div key={label} className={`rounded border border-surface-border p-3 ${bg || 'bg-surface-card'}`}>
              <div className="text-[10px] text-ink-tertiary mb-1">{label}</div>
              <div className={`text-[16px] font-bold ${color} mb-0.5`}>{value}</div>
              <div className="text-[10px] text-ink-tertiary">{sub}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface-card rounded border border-surface-border p-3">
          <div className="text-[10px] font-medium text-ink-secondary mb-2">Revenue over time</div>
          <div className="flex items-end gap-1.5 h-12">
            {[40, 65, 45, 80, 60, 90, 75, 100, 85, 95, 70, 88].map((h, i) => (
              <div key={i} className="flex-1 bg-sage-200 rounded-t" style={{ height: `${h}%` }}>
                {i === 7 && <div className="w-full h-full bg-sage-500 rounded-t" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function PaymentMockup() {
  return (
    <BrowserFrame>
      <div className="bg-surface-bg p-5 flex items-center justify-center" style={{ minHeight: '280px' }}>
        <div className="bg-surface-card border border-surface-border rounded-card p-5 w-full max-w-[280px] shadow-card">
          <div className="text-center mb-4">
            <div className="text-[10px] uppercase tracking-widest text-ink-tertiary mb-1">Invoice #2024-089</div>
            <div className="text-[22px] font-bold text-ink-primary">$4,500.00</div>
            <div className="text-[11px] text-ink-secondary mt-0.5">Due Nov 30, 2024</div>
          </div>
          <div className="border-t border-surface-border py-3 mb-4 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-ink-tertiary">From</span>
              <span className="font-medium text-ink-primary">Alex Johnson</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-ink-tertiary">Service</span>
              <span className="font-medium text-ink-primary">Brand Strategy</span>
            </div>
          </div>
          <button className="w-full bg-sage-500 text-ink-inverse py-2.5 rounded-button text-[12px] font-semibold">
            Pay $4,500.00
          </button>
          <div className="text-center mt-2">
            <span className="text-[10px] text-ink-tertiary">Secured by Stripe</span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

// ── Pricing data (mirrors PricingPage.jsx) ────────────────────────────────────

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: 29,
    annualMonthlyPrice: 24,
    description: 'Everything you need to invoice independently.',
    features: ['Unlimited invoices', 'Unlimited clients', 'AI invoice creation', 'Stripe payments', 'Invoice PDF'],
    featured: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    annualMonthlyPrice: 41,
    description: 'Power tools for growing freelancers.',
    features: ['Everything in Solo', 'Remove ScatterPilot branding', 'Priority AI', 'Reports & analytics', 'Invoice templates'],
    featured: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 99,
    annualMonthlyPrice: 83,
    description: 'For agencies and teams invoicing at scale.',
    features: ['Everything in Pro', 'Team seats', 'Client portal', 'API access', 'Dedicated support'],
    featured: false,
  },
];

const FAQS = [
  {
    q: 'How does ScatterPilot work?',
    a: 'Simply chat with our AI about your work — client name, what you did, and how much to charge. ScatterPilot extracts every detail and generates a professional PDF invoice in seconds.',
  },
  {
    q: 'Is my financial data secure?',
    a: 'Yes. All data is encrypted in transit and at rest using AWS security standards. Payments are processed by Stripe — we never touch your clients\' card details.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. Cancel with one click — no questions asked. You\'ll keep access until the end of your billing period, and we\'ll never delete your data.',
  },
];

// ── Navigation ────────────────────────────────────────────────────────────────

function Nav({ mobileOpen, setMobileOpen }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-surface-border shadow-card'
            : 'bg-white/80 backdrop-blur-md border-b border-surface-border'
        }`}
      >
        <div className="max-w-6xl mx-auto w-full px-6 flex items-center gap-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-sage-500 rounded-lg flex items-center justify-center">
              <span className="text-ink-inverse font-bold text-sm" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>S</span>
            </div>
            <span className="font-semibold text-ink-primary text-body" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>ScatterPilot</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6 flex-1">
            <a href="#features" className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150">Features</a>
            <a href="#pricing" className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150">Pricing</a>
            <a href="#about" className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150">About</a>
            <Link to="/blog" className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150">Blog</Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            <Link
              to="/app"
              className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150 px-3 py-1.5"
            >
              Log In
            </Link>
            <Link
              to="/app"
              onClick={() => analytics.event('CTA', 'Click', 'Nav_StartTrial')}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button text-body-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-auto p-2 text-ink-secondary hover:text-ink-primary transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 pt-16" onClick={() => setMobileOpen(false)}>
          <div
            className="bg-white border-b border-surface-border shadow-dropdown px-6 py-4"
            onClick={e => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-1 mb-4">
              {['#features', '#pricing', '#about'].map(href => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 text-body text-ink-secondary hover:bg-surface-hover hover:text-ink-primary rounded-lg transition-colors"
                >
                  {href.slice(1).charAt(0).toUpperCase() + href.slice(2)}
                </a>
              ))}
              <Link to="/blog" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-body text-ink-secondary hover:bg-surface-hover hover:text-ink-primary rounded-lg transition-colors">
                Blog
              </Link>
            </nav>
            <div className="flex flex-col gap-2 pt-3 border-t border-surface-border">
              <Link to="/app" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 text-center text-body text-ink-secondary border border-surface-border rounded-button hover:bg-surface-hover transition-colors">
                Log In
              </Link>
              <Link to="/app" onClick={() => { setMobileOpen(false); analytics.event('CTA', 'Click', 'Mobile_StartTrial'); }} className="px-4 py-2.5 text-center text-body text-ink-inverse bg-sage-500 hover:bg-sage-600 rounded-button font-medium transition-colors">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pricingPeriod, setPricingPeriod] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    analytics.trackLandingPageView();
  }, []);

  return (
    <div className="min-h-screen bg-surface-bg" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <Nav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-20 px-6" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBF9 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-50 border border-sage-200 rounded-pill text-label text-sage-600 font-medium mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-sage-500" />
                14-day free trial — no credit card required
              </div>
              <h1 className="text-display-xl font-bold text-ink-primary mb-2 leading-tight tracking-tight">
                The smartest way<br />to invoice.
              </h1>
              <h2 className="text-display-xl font-bold text-sage-500 mb-6 leading-tight tracking-tight">
                Get paid faster.
              </h2>
              <p className="text-body-lg text-ink-secondary max-w-lg mb-8 leading-relaxed">
                AI-powered invoicing for consultants and agencies who value their time. Create professional invoices in 30 seconds — not 30 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <Link
                  to="/app"
                  onClick={() => analytics.event('CTA', 'Click', 'Hero_Primary')}
                  className="inline-flex items-center justify-center px-6 py-3 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
                >
                  Start Free Trial
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white border border-surface-border-strong hover:border-sage-300 hover:bg-surface-hover text-ink-primary rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
                >
                  See How It Works
                </a>
              </div>
              <p className="text-body-sm text-ink-tertiary">
                No credit card required · 14-day free trial · Cancel anytime
              </p>
            </div>

            {/* Right: dashboard mockup */}
            <div
              className="hidden lg:block"
              style={{ transform: 'perspective(1000px) rotateY(-5deg)', transformOrigin: 'center center' }}
            >
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ─────────────────────────────────────────────── */}
      <section className="py-12 border-y border-surface-border bg-white px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-body-sm text-ink-tertiary text-center mb-8">Trusted by consultants and agencies worldwide</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { stat: '$2M+', label: 'invoiced' },
              { stat: '500+', label: 'invoices sent' },
              { stat: '30 sec', label: 'avg. creation time' },
              { stat: '4.9/5', label: 'user rating' },
            ].map(({ stat, label }) => (
              <div key={stat}>
                <div className="text-heading-lg font-semibold text-ink-primary">{stat}</div>
                <div className="text-body-sm text-ink-tertiary mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-surface-bg">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-display font-semibold text-ink-primary mb-3">Invoice in three steps</h2>
              <p className="text-body-lg text-ink-secondary">From conversation to paid invoice in under a minute.</p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                icon: <IconChat />,
                title: 'Describe your work',
                desc: 'Tell ScatterPilot about your project in plain English. No forms, no templates — just a natural conversation.',
              },
              {
                num: '02',
                icon: <IconSparkle />,
                title: 'AI creates your invoice',
                desc: 'Our AI extracts the details, formats everything professionally, and generates a polished PDF in seconds.',
              },
              {
                num: '03',
                icon: <IconDollar />,
                title: 'Send & get paid',
                desc: 'Share a payment link or download the PDF. Your client pays online — money hits your bank account.',
              },
            ].map(({ num, icon, title, desc }, i) => (
              <FadeIn key={num} delay={i * 100}>
                <div className="relative bg-surface-card border border-surface-border rounded-card p-6 shadow-card overflow-hidden hover:shadow-card-hover transition-shadow duration-200">
                  {/* Watermark number */}
                  <div className="absolute -top-2 -right-1 text-[5rem] font-bold text-sage-100 leading-none select-none pointer-events-none">
                    {num}
                  </div>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center text-sage-500 mb-4">
                      {icon}
                    </div>
                    <h3 className="text-heading text-ink-primary mb-2">{title}</h3>
                    <p className="text-body text-ink-secondary leading-relaxed">{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-display font-semibold text-ink-primary mb-3">Everything you need. Nothing you don't.</h2>
              <p className="text-body-lg text-ink-secondary max-w-xl mx-auto">Built for professionals who want to spend time on their work, not their admin.</p>
            </div>
          </FadeIn>

          <div className="space-y-20">
            {/* Feature 1 */}
            <FadeIn>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-label uppercase tracking-wider text-sage-500 font-medium mb-3">AI-Powered Creation</div>
                  <h3 className="text-heading-lg text-ink-primary mb-4">AI that speaks your language</h3>
                  <p className="text-body text-ink-secondary leading-relaxed mb-6">
                    Describe your invoice like you'd text a colleague. ScatterPilot's AI understands context, calculates totals, and creates professional invoices from natural conversation.
                  </p>
                  <Link to="/app" className="inline-flex items-center text-body-sm text-sage-500 font-medium hover:text-sage-600 transition-colors">
                    Try it free →
                  </Link>
                </div>
                <ChatMockup />
              </div>
            </FadeIn>

            {/* Feature 2 */}
            <FadeIn>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1">
                  <MetricsMockup />
                </div>
                <div className="order-1 md:order-2">
                  <div className="text-label uppercase tracking-wider text-sage-500 font-medium mb-3">Real-Time Insights</div>
                  <h3 className="text-heading-lg text-ink-primary mb-4">Know your numbers instantly</h3>
                  <p className="text-body text-ink-secondary leading-relaxed mb-6">
                    See exactly how much you're owed, what's been paid, and what's overdue — the moment you open the app. No reconciliation needed.
                  </p>
                  <Link to="/app" className="inline-flex items-center text-body-sm text-sage-500 font-medium hover:text-sage-600 transition-colors">
                    See the dashboard →
                  </Link>
                </div>
              </div>
            </FadeIn>

            {/* Feature 3 */}
            <FadeIn>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-label uppercase tracking-wider text-sage-500 font-medium mb-3">Online Payments</div>
                  <h3 className="text-heading-lg text-ink-primary mb-4">Get paid without chasing</h3>
                  <p className="text-body text-ink-secondary leading-relaxed mb-6">
                    Send invoices with built-in payment links. Clients pay with one click. No more awkward follow-up emails or waiting weeks for a check.
                  </p>
                  <Link to="/app" className="inline-flex items-center text-body-sm text-sage-500 font-medium hover:text-sage-600 transition-colors">
                    Start accepting payments →
                  </Link>
                </div>
                <PaymentMockup />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-surface-bg">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-display font-semibold text-ink-primary mb-3">Simple, transparent pricing</h2>
              <p className="text-body-lg text-ink-secondary mb-8">Start your 14-day free trial. No credit card required.</p>

              {/* Period toggle */}
              <div className="inline-flex items-center bg-surface-card border border-surface-border rounded-pill p-1 gap-1">
                <button
                  onClick={() => setPricingPeriod('monthly')}
                  className={`px-5 py-1.5 rounded-pill text-body-sm font-medium transition-all duration-150 ${
                    pricingPeriod === 'monthly'
                      ? 'bg-sage-500 text-ink-inverse shadow-sm'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPricingPeriod('annual')}
                  className={`px-5 py-1.5 rounded-pill text-body-sm font-medium transition-all duration-150 flex items-center gap-2 ${
                    pricingPeriod === 'annual'
                      ? 'bg-sage-500 text-ink-inverse shadow-sm'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  Annual
                  <span className={`text-label px-1.5 py-0.5 rounded font-semibold ${
                    pricingPeriod === 'annual' ? 'bg-sage-400 text-ink-inverse' : 'bg-sage-100 text-sage-600'
                  }`}>
                    Save 17%
                  </span>
                </button>
              </div>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <FadeIn key={plan.id} delay={i * 80}>
                <div className={`relative bg-surface-card rounded-card border shadow-card flex flex-col h-full transition-shadow duration-200 hover:shadow-card-hover ${
                  plan.featured
                    ? 'border-2 border-sage-500 scale-[1.02]'
                    : 'border-surface-border'
                }`}>
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-sage-500 text-ink-inverse text-label font-semibold px-3 py-1 rounded-pill">
                        ★ Most Popular
                      </span>
                    </div>
                  )}
                  <div className="p-6 flex-1">
                    <div className="mb-4">
                      <h3 className="text-heading text-ink-primary mb-1">{plan.name}</h3>
                      <p className="text-body-sm text-ink-secondary">{plan.description}</p>
                    </div>
                    <div className="mb-6">
                      <span className="text-display font-bold text-ink-primary">
                        ${pricingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualMonthlyPrice}
                      </span>
                      <span className="text-body text-ink-tertiary"> /month</span>
                      {pricingPeriod === 'annual' && (
                        <div className="text-label text-ink-tertiary mt-0.5">Billed annually</div>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map(feat => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <span className="text-sage-500 mt-0.5 flex-shrink-0"><IconCheck /></span>
                          <span className="text-body-sm text-ink-secondary">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 pt-0">
                    <Link
                      to="/app"
                      onClick={() => analytics.event('CTA', 'Click', `Pricing_${plan.name}`)}
                      className={`block w-full text-center py-2.5 rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 ${
                        plan.featured
                          ? 'bg-sage-500 hover:bg-sage-600 text-ink-inverse'
                          : 'bg-surface-bg hover:bg-surface-hover border border-surface-border-strong text-ink-primary'
                      }`}
                    >
                      Start Free Trial
                    </Link>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <p className="text-center text-body-sm text-ink-tertiary mt-8">14-day free trial on all plans. No credit card required.</p>

          {/* FAQ */}
          <div className="mt-16 max-w-2xl mx-auto">
            {FAQS.map((faq, i) => (
              <div key={i} className="border-b border-surface-border last:border-0">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-4 text-left gap-4 focus-visible:outline-none"
                >
                  <span className="text-body font-medium text-ink-primary">{faq.q}</span>
                  <IconChevron open={openFaq === i} />
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${openFaq === i ? 'max-h-40 pb-4' : 'max-h-0'}`}>
                  <p className="text-body-sm text-ink-secondary leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section id="about" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-display font-semibold text-ink-primary">Built for professionals who bill big</h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'ScatterPilot cut my invoicing time from 30 minutes to 30 seconds. I actually look forward to billing now.',
                name: 'Sarah K.',
                role: 'Brand Strategist',
                initials: 'SK',
              },
              {
                quote: 'The AI understood my project scope on the first try. My clients comment on how professional my invoices look.',
                name: 'Marcus T.',
                role: 'UX Consultant',
                initials: 'MT',
              },
              {
                quote: "I switched from Bonsai because ScatterPilot's invoice creation is genuinely faster. The payment links are a game-changer.",
                name: 'Priya R.',
                role: 'Agency Director',
                initials: 'PR',
              },
            ].map(({ quote, name, role, initials }, i) => (
              <FadeIn key={name} delay={i * 80}>
                <div className="bg-surface-card border border-surface-border rounded-card p-6 shadow-card h-full flex flex-col">
                  <blockquote className="text-body text-ink-secondary italic leading-relaxed flex-1 mb-4">
                    "{quote}"
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-label font-semibold text-sage-600">{initials}</span>
                    </div>
                    <div>
                      <div className="text-body-sm font-semibold text-ink-primary">{name}</div>
                      <div className="text-label text-ink-tertiary">{role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-sage-900">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-display-lg font-bold text-white mb-4">Ready to get paid faster?</h2>
            <p className="text-body-lg text-sage-200 mb-8">Start your free 14-day trial. No credit card required.</p>
            <Link
              to="/app"
              onClick={() => analytics.event('CTA', 'Click', 'Final_CTA')}
              className="inline-flex items-center px-8 py-4 bg-white hover:bg-surface-bg text-sage-900 rounded-button font-semibold text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sage-900"
            >
              Start Free Trial
            </Link>
            <p className="text-label text-sage-300 mt-4">Set up in under 2 minutes</p>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-ink-primary text-white px-6 pt-16 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 bg-sage-500 rounded-lg flex items-center justify-center">
                  <span className="text-ink-inverse font-bold text-sm">S</span>
                </div>
                <span className="font-semibold text-white">ScatterPilot</span>
              </div>
              <p className="text-body-sm text-sage-300 leading-relaxed">
                AI-powered invoicing for consultants and agencies who value their time.
              </p>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-label uppercase tracking-wider text-sage-400 font-medium mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[['Features', '#features'], ['Pricing', '#pricing'], ['Integrations', '#'], ['Changelog', '#']].map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-body-sm text-sage-300 hover:text-white transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 className="text-label uppercase tracking-wider text-sage-400 font-medium mb-4">Company</h4>
              <ul className="space-y-2.5">
                {[['About', '#about'], ['Blog', '/blog'], ['Careers', '#'], ['Contact', 'mailto:hello@scatterpilot.com']].map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/') || href.startsWith('mailto') ? (
                      <a href={href} className="text-body-sm text-sage-300 hover:text-white transition-colors">{label}</a>
                    ) : (
                      <a href={href} className="text-body-sm text-sage-300 hover:text-white transition-colors">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {/* Legal */}
            <div>
              <h4 className="text-label uppercase tracking-wider text-sage-400 font-medium mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[['Privacy', '#'], ['Terms', '#'], ['Cookie Policy', '#'], ['Security', '#']].map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-body-sm text-sage-300 hover:text-white transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom row */}
          <div className="border-t border-sage-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-label text-sage-400">© 2026 ScatterPilot. All rights reserved.</p>
            <div className="flex items-center gap-4">
              {/* Twitter/X */}
              <a href="#" className="text-sage-400 hover:text-white transition-colors" aria-label="Twitter">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* LinkedIn */}
              <a href="#" className="text-sage-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
