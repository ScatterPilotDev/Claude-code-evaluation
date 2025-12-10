import { useState, useEffect } from 'react';

export default function CookieNotice() {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem('scatterpilot-cookies-accepted');
    if (!hasAccepted) {
      // Show notice after a brief delay
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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 bg-opacity-95 border-t border-gray-700 shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 text-sm text-gray-200">
          <p className="mb-2 sm:mb-0">
            We use cookies and analytics to improve our service and understand how you use ScatterPilot.
            Your data helps us make the product better.{' '}
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Learn more
            </a>
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
