import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../../services/auth';
import Logo from '../brand/Logo';

// ── Inline SVG icons ────────────────────────────────────────────────────────

function IconHome({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconClients({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconInvoices({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IconReports({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function IconProfile({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconSettings({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconPlus({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconUpgrade({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

// ── Nav items config ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Home',     href: '/app',           Icon: IconHome },
  { label: 'Clients',  href: '/app/clients',   Icon: IconClients },
  { label: 'Invoices', href: '/app/invoices',  Icon: IconInvoices },
  { label: 'Reports',  href: '/app/reports',   Icon: IconReports },
  { label: 'Profile',  href: '/app/profile',   Icon: IconProfile },
];

// Tooltip for tablet icon-only mode (hidden on lg where labels are visible)
function NavTooltip({ label }) {
  return (
    <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 lg:hidden opacity-0 group-hover/navitem:opacity-100 transition-opacity duration-150 z-50">
      <div className="bg-ink-primary text-ink-inverse text-label px-2 py-1 rounded whitespace-nowrap shadow-md">
        {label}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({ onNewInvoice, userEmail = '', userInitials = '', billingStatus = null }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/');
  };

  const isActive = (href) => {
    if (href === '/app') return location.pathname === '/app';
    return location.pathname.startsWith(href);
  };

  const isTrialing = billingStatus?.subscription_status === 'trialing';
  const isExpired = billingStatus?.access?.reason === 'trial_expired' ||
    billingStatus?.subscription_status === 'expired';

  return (
    <>
      {/* ── Desktop + Tablet Sidebar (hidden on mobile) ── */}
      <div className="hidden md:flex fixed inset-y-0 left-0 flex-col w-16 lg:w-[220px] bg-surface-card border-r border-surface-border py-5 px-2 lg:px-3 z-30">

        {/* Brand */}
        <div className="px-1 lg:px-3 mb-4 flex items-center justify-center lg:justify-start">
          <Logo variant="mark" size="sm" className="block lg:hidden" />
          <Logo variant="wordmark" size="sm" className="hidden lg:block" />
        </div>

        {/* New Invoice CTA */}
        {/* Desktop: full button */}
        <button
          onClick={onNewInvoice}
          className="hidden lg:flex items-center justify-center gap-2 w-full py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          <IconPlus className="h-4 w-4" />
          New Invoice
        </button>
        {/* Tablet: icon-only circle */}
        <div className="relative group/navitem flex lg:hidden justify-center">
          <button
            onClick={onNewInvoice}
            className="flex items-center justify-center w-10 h-10 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
            aria-label="New Invoice"
          >
            <IconPlus className="h-5 w-5" />
          </button>
          <NavTooltip label="New Invoice" />
        </div>

        {/* Primary Nav */}
        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const active = isActive(href);
            return (
              <div key={href} className="relative group/navitem">
                <Link
                  to={href}
                  className={[
                    'flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-lg transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset',
                    active
                      ? 'bg-sage-50 text-sage-600 font-medium'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="hidden lg:block text-body">{label}</span>
                </Link>
                <NavTooltip label={label} />
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto border-t border-surface-border pt-3 flex flex-col gap-0.5">
          {/* Upgrade link when trial is expired */}
          {isExpired && (
            <div className="relative group/navitem">
              <Link
                to="/app/pricing"
                className="flex items-center gap-3 px-2 lg:px-3 py-2 rounded-lg text-amber-600 hover:bg-amber-50 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
              >
                <IconUpgrade className="h-5 w-5 flex-shrink-0" />
                <span className="hidden lg:block text-body">Upgrade</span>
              </Link>
              <NavTooltip label="Upgrade" />
            </div>
          )}

          <div className="relative group/navitem">
            <Link
              to="/app/settings"
              className={[
                'flex items-center gap-3 px-2 lg:px-3 py-2 rounded-lg transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset',
                location.pathname.startsWith('/app/settings')
                  ? 'bg-sage-50 text-sage-600 font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
              ].join(' ')}
            >
              <IconSettings className="h-5 w-5 flex-shrink-0" />
              <span className="hidden lg:block text-body">Settings</span>
            </Link>
            <NavTooltip label="Settings" />
          </div>

          {/* User info — clickable, navigates to /app/profile */}
          {userEmail && (
            <>
              {/* Desktop user row */}
              <Link
                to="/app/profile"
                className="hidden lg:flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg hover:bg-surface-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset group/userrow"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
                  <span className="text-label text-sage-600 font-medium">
                    {userInitials || userEmail[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-body-sm text-ink-tertiary truncate block group-hover/userrow:text-ink-secondary transition-colors duration-150">
                    {userEmail}
                  </span>
                  {isTrialing && !isExpired && (
                    <span className="text-label-sm font-semibold text-sage-600 bg-sage-50 px-1.5 py-0.5 rounded">
                      PRO TRIAL
                    </span>
                  )}
                </div>
              </Link>
              {/* Desktop log out */}
              <button
                onClick={handleSignOut}
                className="hidden lg:block w-full text-left px-3 py-1 text-body-sm text-ink-tertiary hover:text-danger-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset rounded"
              >
                Log out
              </button>
              {/* Tablet avatar only — also links to profile */}
              <Link
                to="/app/profile"
                className="flex lg:hidden justify-center py-2 rounded-lg hover:bg-surface-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset"
                aria-label="Profile"
              >
                <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
                  <span className="text-label text-sage-600 font-medium">
                    {userInitials || userEmail[0].toUpperCase()}
                  </span>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile Bottom Nav (hidden on md+) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-card border-t border-surface-border z-30 flex items-center justify-around">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              to={href}
              className={[
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset',
                active ? 'text-sage-500' : 'text-ink-tertiary',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Mobile FAB — New Invoice (hidden on md+) ── */}
      <button
        onClick={onNewInvoice}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-full shadow-lg flex items-center justify-center z-40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        aria-label="New Invoice"
      >
        <IconPlus className="h-6 w-6" />
      </button>
    </>
  );
}
