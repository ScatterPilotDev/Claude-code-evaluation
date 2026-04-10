import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Monogram */}
      <div className="w-12 h-12 bg-sage-500 rounded-xl flex items-center justify-center mb-8">
        <span className="text-ink-inverse font-bold text-lg" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>S</span>
      </div>

      {/* 404 */}
      <p className="text-display-xl font-bold text-sage-100 mb-2 select-none">404</p>
      <h1 className="text-heading-lg text-ink-primary mb-3">Page not found</h1>
      <p className="text-body text-ink-secondary max-w-sm mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/"
          className="px-6 py-2.5 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          Go home
        </Link>
        <Link
          to="/app"
          className="px-6 py-2.5 bg-white border border-surface-border-strong hover:border-sage-300 text-ink-primary rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          Open app
        </Link>
      </div>
    </div>
  );
}
