import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import authService from '../services/auth';
import { useFeedback } from '../contexts/FeedbackContext';

export default function FeedbackButton() {
  const { isOpen, closeFeedback } = useFeedback();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [type, setType] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  // Load user email if logged in
  useEffect(() => {
    const loadUserEmail = async () => {
      try {
        const isAuth = await authService.isAuthenticated();
        if (isAuth) {
          const userInfo = await authService.getUserInfo();
          setEmail(userInfo.email || '');
        }
      } catch (err) {
        console.log('Not authenticated, user will need to enter email');
      }
    };
    loadUserEmail();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get user context
      const pageUrl = window.location.href;
      const userAgent = navigator.userAgent;

      // Get user_id if logged in
      let user_id = null;
      try {
        const isAuth = await authService.isAuthenticated();
        if (isAuth) {
          const userInfo = await authService.getUserInfo();
          user_id = userInfo.sub || userInfo.username;
        }
      } catch (err) {
        // User not logged in - that's okay
      }

      const payload = {
        type,
        subject,
        message,
        email,
        page_url: pageUrl,
        user_agent: userAgent,
        user_id
      };

      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
          throw new Error('Please wait before submitting more feedback (max 3 per hour)');
        }

        throw new Error(errorData.message || 'Failed to submit feedback');
      }

      // Success!
      setSuccess(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        closeFeedback();
        // Reset form
        setTimeout(() => {
          setSuccess(false);
          setType('bug');
          setSubject('');
          setMessage('');
          // Don't reset email - keep it for convenience
        }, 300);
      }, 2000);

    } catch (err) {
      console.error('Feedback submission error:', err);
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    closeFeedback();
    setError('');
  };

  return (
    <>
      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              <div className="p-6 pb-4">
                <h2 className="text-2xl font-bold text-slate-100">
                  Send Feedback or Report an Issue
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  We'll respond within 24 hours
                </p>
              </div>

              {/* Success Message */}
              {success && (
                <div className="mx-6 mb-4 rounded-lg bg-green-900/30 border border-green-700/50 p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-medium text-green-300">
                      Feedback sent! We'll respond within 24 hours.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mx-6 mb-4 rounded-lg bg-red-900/30 border border-red-700/50 p-4">
                  <p className="text-sm font-medium text-red-300">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
                {/* Type Dropdown */}
                <div>
                  <label htmlFor="feedback-type" className="block text-sm font-medium text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    id="feedback-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading || success}
                  >
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="question">Question</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="feedback-subject" className="block text-sm font-medium text-slate-300 mb-1">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="feedback-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your feedback"
                    maxLength={200}
                    required
                    className="w-full px-3 py-2 bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-slate-500"
                    disabled={loading || success}
                  />
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="feedback-message" className="block text-sm font-medium text-slate-300 mb-1">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please provide details..."
                    rows={5}
                    maxLength={5000}
                    required
                    className="w-full px-3 py-2 bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none placeholder-slate-500"
                    disabled={loading || success}
                  />
                  <p className="mt-1 text-xs text-slate-400 text-right">
                    {message.length} / 5000 characters
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="feedback-email" className="block text-sm font-medium text-slate-300 mb-1">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-3 py-2 bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-slate-500"
                    disabled={loading || success}
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors font-medium"
                    disabled={loading || success}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-brand hover:bg-gradient-brand-hover text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={loading || success}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      'Send Feedback'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
