import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../../services/auth';

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

// ── Nav items config ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Home',     href: '/app',           Icon: IconHome },
  { label: 'Clients',  href: '/app/clients',   Icon: IconClients },
  { label: 'Invoices', href: '/app/invoices',  Icon: IconInvoices },
  { label: 'Reports',  href: '/app/reports',   Icon: IconReports },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({ onNewInvoice, userEmail = '', userInitials = '' }) {
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

  return (
    <div className="fixed inset-y-0 left-0 flex flex-col w-[220px] bg-surface-card border-r border-surface-border py-5 px-3">

      {/* ── Brand ── */}
      <div className="px-3 mb-4">
        <span className="text-label uppercase tracking-widest text-ink-tertiary font-medium">
          ScatterPilot
        </span>
      </div>

      {/* ── New Invoice CTA ── */}
      <button
        onClick={onNewInvoice}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
      >
        <IconPlus className="h-4 w-4" />
        New Invoice
      </button>

      {/* ── Primary Nav ── */}
      <nav className="mt-6 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              to={href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-lg text-body transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset',
                active
                  ? 'bg-sage-50 text-sage-600 font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom section ── */}
      <div className="mt-auto border-t border-surface-border pt-3 flex flex-col gap-0.5">
        <Link
          to="/settings"
          className={[
            'flex items-center gap-3 px-3 py-2 rounded-lg text-body transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-inset',
            location.pathname === '/settings'
              ? 'bg-sage-50 text-sage-600 font-medium'
              : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
          ].join(' ')}
        >
          <IconSettings className="h-4 w-4 flex-shrink-0" />
          Settings
        </Link>

        {/* User info */}
        {userEmail && (
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
              <span className="text-label text-sage-600 font-medium">
                {userInitials || userEmail[0].toUpperCase()}
              </span>
            </div>
            <span className="text-body-sm text-ink-tertiary truncate">
              {userEmail}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
