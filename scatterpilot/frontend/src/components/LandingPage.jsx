import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import analytics from '../utils/analytics';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const AnimatedSection = ({ children, className = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Track landing page view
  useEffect(() => {
    analytics.trackLandingPageView();
  }, []);

  // Scroll behavior for floating nav
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqData = [
    {
      question: "How does ScatterPilot work?",
      answer: "Simply chat with our AI about your work. Tell us the client details, what you did, and how much to charge. Our AI extracts the information and generates a professional PDF invoice instantly."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. All data is encrypted in transit and at rest using AWS security standards. We never share your information with third parties. Your invoices are stored securely in AWS S3 with AES256 encryption."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes, you can cancel your subscription at any time with no questions asked. You'll retain access until the end of your billing period."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards through Stripe's secure payment processing."
    },
    {
      question: "Do I need to install anything?",
      answer: "No installation required. ScatterPilot works directly in your browser on any device - desktop, tablet, or phone."
    }
  ];

  return (
    <div className="min-h-screen bg-light-bg-primary">
      {/* Floating Pill Navigation */}
      <nav className={`floating-nav ${isScrolled ? 'scrolled' : ''}`} aria-label="Main navigation">
        <div className="floating-nav-logo flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-light-accent-sage" aria-hidden="true" />
          <span>ScatterPilot</span>
        </div>

        <div className="floating-nav-links">
          <a href="#features" className="focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 rounded-md px-2 py-1">Features</a>
          <a href="#pricing" className="focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 rounded-md px-2 py-1">Pricing</a>
          <a href="#about" className="focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 rounded-md px-2 py-1">About</a>
          <Link to="/blog" className="focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 rounded-md px-2 py-1">Blog</Link>
        </div>

        {/* Hamburger Menu Button (Mobile Only) */}
        <button
          className="hamburger-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        <div className="floating-nav-cta">
          <Link
            to="/app"
            className="px-5 py-2 bg-transparent border border-light-accent-sage text-light-text-secondary rounded-full text-sm font-medium hover:bg-light-accent-sage hover:text-white focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 transition-all duration-300"
            aria-label="Log in to ScatterPilot"
          >
            Log In
          </Link>
          <Link
            to="/app"
            onClick={() => analytics.event('CTA', 'Click', 'Nav_CTA')}
            className="px-6 py-2 bg-light-accent-sage text-white rounded-full text-sm font-semibold hover:bg-light-accent-sage-dark focus:outline-none focus:ring-2 focus:ring-light-accent-sage-dark focus:ring-offset-2 transition-all duration-300 shadow-light-sage"
            aria-label="Sign up for ScatterPilot"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
          <Link to="/blog" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
          <Link to="/app" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
        </div>
      )}

      {/* Hero Section - Product Screenshot Focus */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-20 bg-light-bg-primary">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left: Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-[64px] font-bold leading-tight mb-6 text-light-text-primary tracking-tight">
                Create Professional Invoices in 30 Seconds
              </h1>
              <p className="text-xl text-light-text-secondary mb-10 leading-relaxed max-w-[540px]">
                AI-powered invoicing that saves you hours every month. No forms, no hassle—just describe your project and get a professional PDF instantly.
              </p>

              {/* Social Proof */}
              <div className="flex items-center gap-3 mb-8">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-light-accent-sage border-2 border-white flex items-center justify-center text-white text-sm font-semibold">
                    JD
                  </div>
                  <div className="w-10 h-10 rounded-full bg-light-accent-purple border-2 border-white flex items-center justify-center text-white text-sm font-semibold">
                    SM
                  </div>
                  <div className="w-10 h-10 rounded-full bg-light-accent-sage border-2 border-white flex items-center justify-center text-white text-sm font-semibold">
                    AL
                  </div>
                </div>
                <p className="text-sm text-light-text-muted font-medium">
                  Join 80+ founders already using ScatterPilot
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <Link
                  to="/app"
                  onClick={() => analytics.event('CTA', 'Click', 'Hero_Primary_CTA')}
                  className="px-8 py-4 bg-light-accent-sage text-white rounded-xl text-lg font-semibold hover:bg-light-accent-sage-dark focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 transition-all duration-300 shadow-light-sage hover:shadow-light-md hover:-translate-y-0.5 inline-block"
                  aria-label="Get started with ScatterPilot for free"
                >
                  Get Started Free
                </Link>
                <a
                  href="#demo"
                  className="px-8 py-4 bg-white border-2 border-light-accent-sage text-light-text-secondary rounded-xl text-lg font-semibold hover:bg-light-bg-primary focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 transition-all duration-300 inline-block"
                  aria-label="Watch ScatterPilot demo video"
                >
                  Watch Demo
                </a>
              </div>
            </motion.div>

            {/* Right: Product Screenshot */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div
                className="bg-white border border-light-border-light rounded-2xl shadow-light-lg p-2 transform perspective-1000 hover:scale-[1.02] hover:rotate-y-0 transition-all duration-500"
                style={{ transform: 'perspective(1000px) rotateY(-5deg)' }}
              >
                {/* Screenshot Container */}
                <div className="bg-light-bg-tertiary rounded-xl p-8 shadow-inner">
                  {/* Mock Chat Interface */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-light-bg-tertiary rounded-full flex items-center justify-center flex-shrink-0">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-light-text-muted" />
                      </div>
                      <div className="flex-1 bg-white rounded-lg p-4 shadow-sm border border-light-border-light">
                        <p className="text-sm text-light-text-muted mb-1 font-medium">You</p>
                        <p className="text-light-text-secondary">Invoice Sarah's Bakery for logo design, $800, due in 30 days</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-light-accent-sage rounded-full flex items-center justify-center flex-shrink-0">
                        <SparklesIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 bg-light-accent-sage/10 border border-light-accent-sage/30 rounded-lg p-4">
                        <p className="text-sm mb-1 font-medium text-light-text-primary">AI Assistant</p>
                        <p className="mb-3 text-light-text-secondary">Perfect! I've created your invoice for Sarah's Bakery.</p>
                        <div className="bg-white rounded-lg p-3 text-sm space-y-2 border border-light-border-light shadow-sm">
                          <div className="flex justify-between text-light-text-secondary">
                            <span>Client:</span>
                            <span className="font-semibold text-light-text-primary">Sarah's Bakery</span>
                          </div>
                          <div className="flex justify-between text-light-text-secondary">
                            <span>Service:</span>
                            <span className="font-semibold text-light-text-primary">Logo Design</span>
                          </div>
                          <div className="flex justify-between text-light-text-secondary">
                            <span>Amount:</span>
                            <span className="font-semibold text-light-text-primary">$800.00</span>
                          </div>
                          <div className="flex justify-between text-light-text-secondary">
                            <span>Due Date:</span>
                            <span className="font-semibold text-light-text-primary">30 days</span>
                          </div>
                        </div>
                        <button className="mt-3 w-full bg-light-accent-sage text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-light-accent-sage-dark transition-colors flex items-center justify-center gap-2 shadow-sm">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <AnimatedSection>
        <section id="features" className="py-32 px-4 sm:px-6 lg:px-20 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl lg:text-[48px] font-bold text-light-text-primary mb-4 tracking-tight">
                How It Works
              </h2>
              <p className="text-lg text-light-text-secondary">
                Three simple steps to professional invoices
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-12"
            >
              {/* Step 1 */}
              <motion.div
                variants={fadeInUp}
                className="bg-white border border-light-border-light rounded-2xl p-10 hover:shadow-light-md hover:-translate-y-1 transition-all duration-300 focus-within:ring-2 focus-within:ring-light-accent-sage focus-within:ring-offset-2"
              >
                <div className="w-14 h-14 bg-light-accent-sage rounded-full flex items-center justify-center mb-6 shadow-light-sm">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-2xl font-semibold text-light-text-primary mb-3">
                  Chat Naturally
                </h3>
                <p className="text-light-text-secondary leading-relaxed">
                  Describe your invoice like texting a friend. No forms, just natural conversation.
                </p>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                variants={fadeInUp}
                className="bg-white border border-light-border-light rounded-2xl p-10 hover:shadow-light-md hover:-translate-y-1 transition-all duration-300 focus-within:ring-2 focus-within:ring-light-accent-purple focus-within:ring-offset-2"
              >
                <div className="w-14 h-14 bg-light-accent-purple rounded-full flex items-center justify-center mb-6 shadow-light-sm">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-2xl font-semibold text-light-text-primary mb-3">
                  AI Creates It
                </h3>
                <p className="text-light-text-secondary leading-relaxed">
                  Our AI extracts details and formats professionally in seconds.
                </p>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                variants={fadeInUp}
                className="bg-white border border-light-border-light rounded-2xl p-10 hover:shadow-light-md hover:-translate-y-1 transition-all duration-300 focus-within:ring-2 focus-within:ring-light-accent-sage focus-within:ring-offset-2"
              >
                <div className="w-14 h-14 bg-light-accent-sage rounded-full flex items-center justify-center mb-6 shadow-light-sm">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-2xl font-semibold text-light-text-primary mb-3">
                  Download PDF
                </h3>
                <p className="text-light-text-secondary leading-relaxed">
                  Get a polished invoice ready to send in seconds.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </AnimatedSection>

      {/* Demo Video Section */}
      <AnimatedSection>
        <section id="demo" className="py-32 px-4 sm:px-6 lg:px-20 bg-light-accent-purple-light">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl lg:text-[48px] font-bold text-light-text-primary mb-4 tracking-tight">
              See ScatterPilot In Action
            </h2>
            <p className="text-xl text-light-text-secondary mb-12 max-w-2xl mx-auto">
              Watch how we turn a simple conversation into a professional invoice
            </p>

            {/* Video Container */}
            <div className="relative w-full max-w-4xl mx-auto mb-12">
              <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-2xl shadow-light-lg border-2 border-light-border-medium bg-white">
                <iframe
                  className="absolute top-0 left-0 w-full h-full rounded-2xl border-0"
                  src="https://www.youtube.com/embed/tUls9TIqUuU"
                  title="ScatterPilot Demo - AI Invoice Generator"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            <Link
              to="/app"
              onClick={() => analytics.event('CTA', 'Click', 'Demo_CTA')}
              className="inline-block px-10 py-5 bg-light-accent-sage text-white rounded-xl font-bold text-xl hover:bg-light-accent-purple focus:outline-none focus:ring-2 focus:ring-light-accent-purple focus:ring-offset-2 transition-all duration-300 shadow-light-sage hover:shadow-light-purple hover:-translate-y-0.5"
              aria-label="Try ScatterPilot for free"
            >
              Try It Free →
            </Link>
          </div>
        </section>
      </AnimatedSection>

      {/* Pricing Section */}
      <AnimatedSection>
        <section id="pricing" className="py-32 px-4 sm:px-6 lg:px-20 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl lg:text-[48px] font-bold text-light-text-primary mb-4 tracking-tight">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-light-text-secondary">
                Start free, upgrade when you need more
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Tier */}
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                className="bg-white border-2 border-light-border-light rounded-2xl p-12 shadow-light-sm hover:shadow-light-md transition-all duration-300"
              >
                <div className="inline-block bg-light-bg-primary text-light-text-muted px-4 py-1.5 rounded-full text-xs font-semibold mb-6">
                  FREE FOREVER
                </div>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-light-text-primary">$0</span>
                  <span className="text-light-text-muted text-xl ml-2">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-light-accent-sage flex-shrink-0 mt-0.5" />
                    <span className="text-light-text-secondary">5 invoices per month</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-light-accent-sage flex-shrink-0 mt-0.5" />
                    <span className="text-light-text-secondary">Professional templates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-light-accent-sage flex-shrink-0 mt-0.5" />
                    <span className="text-light-text-secondary">PDF download</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-light-accent-sage flex-shrink-0 mt-0.5" />
                    <span className="text-light-text-secondary">Email support</span>
                  </li>
                </ul>
                <Link
                  to="/app"
                  onClick={() => analytics.event('CTA', 'Click', 'Free_Plan_CTA')}
                  className="block w-full text-center px-6 py-3 bg-white border-2 border-light-accent-sage text-light-text-secondary rounded-xl font-semibold hover:bg-light-bg-primary focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 transition-all duration-300"
                  aria-label="Get started with free plan"
                >
                  Get Started Free
                </Link>
              </motion.div>

              {/* Pro Tier */}
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                className="bg-light-accent-purple border-2 border-light-accent-purple rounded-2xl p-12 text-white shadow-light-purple-lg relative transform scale-105"
              >
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white text-light-accent-purple px-6 py-2 rounded-full text-xs font-bold shadow-lg">
                    MOST POPULAR
                  </span>
                </div>
                <div className="mb-6">
                  <span className="text-5xl font-bold">$18</span>
                  <span className="text-white/80 text-xl ml-2">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <span>Unlimited invoices</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <span>Custom branding</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <span>All Free features</span>
                  </li>
                </ul>
                <Link
                  to="/app"
                  onClick={() => analytics.event('CTA', 'Click', 'Pro_Plan_CTA')}
                  className="block w-full text-center px-6 py-3 bg-white text-light-accent-purple rounded-xl font-semibold hover:bg-light-bg-primary focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-light-accent-purple transition-all duration-300 shadow-sm"
                  aria-label="Start Pro plan trial"
                >
                  Start Pro Trial
                </Link>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Founder Story */}
      <AnimatedSection>
        <section id="about" className="py-32 px-4 sm:px-6 lg:px-20 bg-light-bg-primary">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl lg:text-[48px] font-bold text-light-text-primary mb-4 tracking-tight">
                Built by a freelancer, for professionals
              </h2>
            </div>
            <div className="bg-white border border-light-border-light rounded-2xl p-12 shadow-light-sm">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full bg-light-accent-sage/20 border-2 border-light-accent-sage flex items-center justify-center">
                    <UserCircleIcon className="h-16 w-16 text-light-accent-sage" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <blockquote className="text-lg md:text-xl text-light-text-secondary leading-relaxed mb-6 italic">
                    "As a freelancer running multiple side businesses, I was spending 30 minutes on every single invoice. The repetitive data entry, formatting, calculations—it was draining time I could spend on actual work. I knew AI could solve this, so I built ScatterPilot. Now I create invoices in under 2 minutes just by chatting."
                  </blockquote>
                  <div>
                    <p className="font-bold text-xl text-light-text-primary">— Ale Rodriguez</p>
                    <p className="text-light-text-muted">Founder of ScatterPilot</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* FAQ Section */}
      <AnimatedSection>
        <section className="py-32 px-4 sm:px-6 lg:px-20 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl lg:text-[48px] font-bold text-light-text-primary mb-4 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-4">
              {faqData.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white border border-light-border-light rounded-xl overflow-hidden hover:shadow-light-sm transition-all duration-300"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-light-bg-primary/50 transition-colors"
                  >
                    <span className="font-semibold text-lg text-light-text-primary">
                      {faq.question}
                    </span>
                    <ChevronDownIcon
                      className={`h-5 w-5 text-light-text-muted transition-transform duration-300 ${
                        openFaq === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openFaq === index ? 'max-h-96' : 'max-h-0'
                    }`}
                  >
                    <div className="px-6 pb-5 text-light-text-secondary leading-relaxed">
                      {faq.answer}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Final CTA */}
      <AnimatedSection>
        <section className="py-32 px-4 sm:px-6 lg:px-20 bg-light-bg-primary">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl lg:text-[48px] font-bold text-light-text-primary mb-6 tracking-tight">
                Ready to save hours on invoicing?
              </h2>
              <p className="text-xl text-light-text-secondary mb-8">
                Join professionals and businesses who've reclaimed their time with AI-powered invoicing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/app"
                  onClick={() => analytics.event('CTA', 'Click', 'Final_CTA')}
                  className="inline-block px-12 py-5 bg-light-accent-sage text-white rounded-xl font-bold text-xl hover:bg-light-accent-purple focus:outline-none focus:ring-2 focus:ring-light-accent-purple focus:ring-offset-2 transition-all duration-300 shadow-light-sage hover:shadow-light-purple hover:-translate-y-0.5"
                  aria-label="Create your first invoice free"
                >
                  Create Your First Invoice Free
                </Link>
                <a
                  href="#pricing"
                  className="inline-block px-12 py-5 bg-white border-2 border-light-accent-sage text-light-text-secondary rounded-xl font-bold text-xl hover:bg-light-bg-primary focus:outline-none focus:ring-2 focus:ring-light-accent-sage focus:ring-offset-2 transition-all duration-300"
                  aria-label="View pricing plans"
                >
                  View Pricing
                </a>
              </div>
              <p className="text-light-text-muted mt-6 text-lg">No credit card required. 5 free invoices to try.</p>
            </motion.div>
          </div>
        </section>
      </AnimatedSection>

      {/* Footer */}
      <footer className="py-20 px-4 sm:px-6 lg:px-20 bg-light-bg-primary border-t border-light-border-light">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center mb-4">
                <SparklesIcon className="h-8 w-8 text-light-accent-sage" />
                <span className="ml-2 text-xl font-bold text-light-text-primary">ScatterPilot</span>
              </div>
              <p className="text-sm text-light-text-secondary">
                AI-powered invoicing for professionals and businesses.
              </p>
            </div>
            <div>
              <h4 className="text-light-text-primary font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Pricing</a></li>
                <li><a href="#demo" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-light-text-primary font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/blog" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Blog</Link></li>
                <li><a href="#about" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">About</a></li>
                <li><a href="mailto:contact@scatterpilot.com" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-light-text-primary font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-light-text-secondary hover:text-light-accent-sage transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-light-border-light pt-8 text-sm text-center text-light-text-muted">
            <p>&copy; 2025 ScatterPilot. Built by Ale Rodriguez. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
