import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import authService from '../../services/auth';
import api from '../../services/api';

export default function Layout({
  children,
  onNewInvoice,
  onInvoiceClick,
  selectedInvoiceId,
  refreshInvoiceList
}) {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserInfo();
  }, []);

  const getInitials = (name) => {
    if (!name || !name.trim()) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getFirstName = (fullName) => {
    if (!fullName || !fullName.trim()) return '';
    return fullName.trim().split(' ')[0];
  };

  const loadUserInfo = async () => {
    try {
      // Get email from auth service
      const userInfo = await authService.getUserInfo();
      const email = userInfo?.email || '';
      setUserEmail(email);

      // Get profile data for contact_name
      try {
        const profile = await api.getProfile();
        const contactName = profile?.contact_name || '';

        if (contactName) {
          setUserName(contactName);
          setUserInitials(getInitials(contactName));
        } else {
          // Fallback to email if no contact_name
          setUserName('');
          setUserInitials(email ? email[0].toUpperCase() : 'U');
        }
      } catch (profileErr) {
        console.error('Failed to load profile:', profileErr);
        // Fallback to email if profile fetch fails
        setUserName('');
        setUserInitials(email ? email[0].toUpperCase() : 'U');
      }
    } catch (err) {
      console.error('Failed to load user info:', err);
      setUserInitials('U');
    }
  };

  const handleNewInvoice = () => {
    setMobileMenuOpen(false); // Close mobile menu when creating new invoice
    if (onNewInvoice) {
      onNewInvoice();
    } else {
      navigate('/app');
    }
  };

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 hover:bg-gray-200 transition-colors shadow-lg"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? (
          <XMarkIcon className="h-6 w-6" />
        ) : (
          <Bars3Icon className="h-6 w-6" />
        )}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/70 z-30"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop: always visible, Mobile: slides in */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-40 w-80 transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar
          onNewInvoice={handleNewInvoice}
          onInvoiceClick={onInvoiceClick}
          selectedInvoiceId={selectedInvoiceId}
          refreshInvoiceList={refreshInvoiceList}
          userEmail={userEmail}
          userName={userName}
          userInitials={userInitials}
          onNavigate={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" role="main">
        {children}
      </main>
    </div>
  );
}

// Welcome Screen Component (Claude.ai-style)
export function WelcomeScreen({ userName, onNewInvoice, quickActions = [] }) {
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getFirstName = (fullName) => {
    if (!fullName || !fullName.trim()) return '';
    return fullName.trim().split(' ')[0];
  };

  // Handle action clicks - support both onClick and href
  const handleActionClick = (action) => {
    if (action.disabled) return;

    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      navigate(action.href);
    }
  };

  const defaultQuickActions = [
    {
      title: 'Create Invoice',
      description: 'Generate a new invoice',
      icon: '📄',
      onClick: onNewInvoice
    },
    {
      title: 'View Reports',
      description: 'See your invoicing stats',
      icon: '📊',
      disabled: true,
      comingSoon: true
    },
    {
      title: 'Manage Profile',
      description: 'Update your info',
      icon: '⚙️',
      href: '/account'
    },
  ];

  const actions = quickActions.length > 0 ? quickActions : defaultQuickActions;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Greeting */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-navy">
            {getGreeting()}{userName ? `, ${getFirstName(userName)}` : ''}
          </h1>
          <p className="text-xl text-navy-light">
            Ready to create a new invoice?
          </p>
        </div>

        {/* Main Action */}
        <button
          onClick={onNewInvoice}
          className="mx-auto px-8 py-4 bg-sage hover:bg-sage-dark text-white rounded-xl font-semibold text-lg shadow-md transition-all duration-300 transform hover:scale-105"
        >
          Start New Invoice
        </button>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 pt-8">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
              className={`
                relative p-6 bg-white hover:bg-cream border border-gray-200 rounded-xl
                transition-all duration-200 text-left shadow-sm
                ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:border-sage cursor-pointer'}
              `}
            >
              {action.comingSoon && (
                <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-purple-light text-purple rounded">
                  Soon
                </span>
              )}
              <div className="text-3xl mb-3">{action.icon}</div>
              <h3 className="text-lg font-semibold text-navy mb-1">
                {action.title}
              </h3>
              <p className="text-sm text-navy-light">
                {action.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
