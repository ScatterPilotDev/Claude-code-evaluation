import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Eager load critical components
import CookieNotice from './components/CookieNotice';
import FeedbackButton from './components/FeedbackButton';
import { FeedbackProvider } from './contexts/FeedbackContext';

// Lazy load route components for code splitting
const LandingPage = lazy(() => import('./components/LandingPage'));
const AppWithSidebar = lazy(() => import('./components/AppWithSidebar'));
const Pricing = lazy(() => import('./components/Pricing'));
const Account = lazy(() => import('./components/Account'));
const Settings = lazy(() => import('./components/Settings'));
const Success = lazy(() => import('./components/Success'));
const StripeCallback = lazy(() => import('./pages/StripeCallback'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-sage-200 border-t-sage-500"></div>
        <p className="mt-4 text-body text-ink-secondary">Loading…</p>
      </div>
    </div>
  );
}

export default function Router() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <FeedbackProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              {/* Authenticated app shell — all /app/* routes */}
              <Route path="/app" element={<AppWithSidebar />} />
              <Route path="/app/invoices" element={<AppWithSidebar />} />
              <Route path="/app/invoices/new" element={<Navigate to="/app/invoices" replace />} />
              <Route path="/app/clients" element={<AppWithSidebar />} />
              <Route path="/app/clients/:clientId" element={<AppWithSidebar />} />
              <Route path="/app/reports" element={<AppWithSidebar />} />
              <Route path="/app/settings" element={<AppWithSidebar />} />
              <Route path="/app/settings/payments" element={<AppWithSidebar />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/success" element={<Success />} />
              <Route path="/stripe-callback" element={<StripeCallback />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <CookieNotice />
          <FeedbackButton />
        </FeedbackProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
