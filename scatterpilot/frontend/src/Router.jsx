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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <p className="mt-4 text-slate-400">Loading...</p>
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
              <Route path="/app" element={<AppWithSidebar />} />
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
