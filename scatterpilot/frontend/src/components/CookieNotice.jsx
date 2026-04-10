import { useState, useEffect } from 'react';

export default function CookieNotice() {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem('scatterpilot-cookies-accepted');
    if (!hasAccepted) {
      const timer = setTimeout(() => {
        setShowNotice(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('scatterpilot-cookies-accepted', 'true');
    setShowNotice(false);
  };

  const handleDecline = () => {
    localStorage.setItem('scatterpilot-cookies-accepted', 'false');
    setShowNotice(false);
  };

  if (!showNotice) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="max-w-3xl mx-auto bg-surface-card border border-surface-border rounded-card shadow-modal p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 text-body-sm text-ink-secondary">
          We use cookies and analytics to improve ScatterPilot and understand how you use it.{' '}
          <a
            href="#"
            className="text-sage-500 hover:text-sage-600 underline transition-colors"
          >
            Learn more
          </a>
        </p>
        <div className="flex gap-3 items-center flex-shrink-0">
          <button
            onClick={handleDecline}
            className="text-body-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-150 px-3 py-1.5"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-ink-inverse text-body-sm font-medium rounded-button transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
