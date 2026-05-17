import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface from './ChatInterface';
import InvoicePreview from './InvoicePreview';
import api from '../services/api';
import authService from '../services/auth';
import { useBreakpoint } from '../utils/useBreakpoint';

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function IconProfile({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconBack({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}

function IconDoc({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Invoices', path: '/app/invoices', Icon: IconInvoices },
  { label: 'Clients',  path: '/app/clients',  Icon: IconClients },
  { label: 'Reports',  path: '/app/reports',  Icon: IconReports },
  { label: 'Settings', path: '/app/settings', Icon: IconSettings },
  { label: 'Profile',  path: '/app/profile',  Icon: IconProfile },
];

// ── History Rail (desktop left panel, light) ──────────────────────────────────

const RECENTS_LIMIT = 8;

function HistoryRail({ conversations, activeId, userEmail, initials, onNewInvoice }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [isRecentsOpen, setIsRecentsOpen] = useState(() => {
    try { return localStorage.getItem('sp_recents_open') !== 'false'; } catch { return true; }
  });
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [customTitles, setCustomTitles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sp_conv_titles') || '{}'); } catch { return {}; }
  });

  const toggleRecents = () => {
    const next = !isRecentsOpen;
    setIsRecentsOpen(next);
    try { localStorage.setItem('sp_recents_open', String(next)); } catch {}
  };

  const getTitle = (conv) => {
    if (customTitles[conv.conversation_id]) return customTitles[conv.conversation_id];
    if (conv.client_name) return `${conv.client_name} Invoice`;
    if (conv.title) return conv.title;
    const date = conv.updated_at || conv.created_at;
    if (date) {
      try {
        const d = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `Invoice · ${d}`;
      } catch {}
    }
    return 'New Invoice';
  };

  const startEdit = (conv, e) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(conv.conversation_id);
    setEditingTitle(getTitle(conv));
  };

  const commitEdit = (id) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      const next = { ...customTitles, [id]: trimmed };
      setCustomTitles(next);
      try { localStorage.setItem('sp_conv_titles', JSON.stringify(next)); } catch {}
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const visibleConvs = showAll ? conversations : conversations.slice(0, RECENTS_LIMIT);
  const hasMore = conversations.length > RECENTS_LIMIT;

  return (
    <div className="hidden lg:flex w-[220px] flex-shrink-0 flex-col h-full bg-white border-r border-[#E2E5DE]">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#4A6741] flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white tracking-wide">SP</span>
          </div>
          <span className="text-[15px] font-medium text-[#1A2318]">ScatterPilot</span>
        </div>
      </div>

      {/* New Invoice button */}
      <div className="px-4 mb-4 flex-shrink-0">
        <button
          onClick={onNewInvoice}
          className="w-full py-2.5 px-3 bg-[#4A6741] hover:bg-[#3D5636] text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Invoice
        </button>
      </div>

      {/* Conversation history (scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3">

        {/* Collapsible RECENT header */}
        <button
          onClick={toggleRecents}
          className="w-full flex items-center justify-between px-1.5 pt-1 pb-2 text-[#8A9484] hover:text-[#5F6B5A] transition-colors"
        >
          <span className="text-[11px] uppercase tracking-wide font-medium">Recent</span>
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${isRecentsOpen ? '' : '-rotate-90'}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {isRecentsOpen && (
          <>
            {conversations.length === 0 && (
              <p className="text-[12px] text-[#C8CEC3] px-1.5 py-1">No recent conversations</p>
            )}
            {visibleConvs.map(conv => {
              const isActive = conv.conversation_id === activeId;
              const title = getTitle(conv);
              const dateStr = formatDate(conv.updated_at || conv.created_at);
              const isEditing = editingId === conv.conversation_id;

              return (
                <div
                  key={conv.conversation_id}
                  className={`group relative rounded-md transition-colors mb-0.5 ${
                    isActive
                      ? 'bg-[#F4F7F3] border-l-2 border-[#4A6741]'
                      : 'hover:bg-[#F4F7F3] border-l-2 border-transparent'
                  }`}
                >
                  <button
                    onClick={() => !isEditing && navigate(`/app/invoice/${conv.conversation_id}`)}
                    onDoubleClick={e => startEdit(conv, e)}
                    className="w-full text-left px-3 py-2 pr-8"
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={() => commitEdit(conv.conversation_id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEdit(conv.conversation_id); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-[13px] font-medium text-[#1A2318] bg-transparent border-0 border-b border-[#CEDCC9] focus:outline-none focus:border-[#4A6741] leading-tight pb-0.5"
                      />
                    ) : (
                      <p className={`text-[13px] truncate leading-tight ${isActive ? 'font-medium text-[#1A2318]' : 'text-[#5F6B5A]'}`}>
                        {title}
                      </p>
                    )}
                    {dateStr && !isEditing && (
                      <p className="text-[11px] text-[#8A9484] mt-0.5 truncate">{dateStr}</p>
                    )}
                  </button>

                  {/* Pencil edit button — shown on hover */}
                  {!isEditing && (
                    <button
                      onClick={e => startEdit(conv, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rename"
                    >
                      <svg className="w-3 h-3 text-[#C8CEC3] hover:text-[#5F6B5A] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Show all / Show less */}
            {hasMore && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full text-left px-3 py-1.5 text-[13px] text-[#8A9484] hover:text-[#5F6B5A] transition-colors"
              >
                {showAll ? 'Show less' : `Show all (${conversations.length})`}
              </button>
            )}
          </>
        )}

        {/* Collapsed summary */}
        {!isRecentsOpen && conversations.length > 0 && (
          <p className="text-[12px] text-[#8A9484] px-1.5 py-1">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Bottom nav links */}
      <div className="flex-shrink-0 mt-auto border-t border-[#E2E5DE] pt-2 pb-1">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isNavActive = location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2.5 py-2 mx-2 rounded-md text-[14px] transition-colors ${
                isNavActive
                  ? 'px-2 text-[#4A6741] bg-[#F4F7F3] border-l-2 border-[#4A6741] rounded-l-none -ml-[1px]'
                  : 'px-3 text-[#5F6B5A] hover:text-[#1A2318] hover:bg-[#F4F7F3]'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* User info */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-[#E2E5DE] bg-[#F4F7F3] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[#CEDCC9] flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-[#4A6741]">{initials}</span>
        </div>
        <span className="text-[12px] text-[#5F6B5A] truncate flex-1 min-w-0">{userEmail}</span>
      </div>
    </div>
  );
}

// ── Placeholder cell ──────────────────────────────────────────────────────────

function Dash() {
  return <span className="text-[#C8CEC3]">——</span>;
}

// ── Partial Invoice Document (before invoice is generated) ────────────────────

function PartialInvoiceDoc({ clientName, businessName, fromEmail }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="px-6 pt-6 pb-8 font-sans select-none">
      {/* Invoice title */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-[22px] font-semibold text-[#1A2318] tracking-tight leading-tight">INVOICE</h2>
          <p className="text-[12px] text-[#C8CEC3] mt-1 font-mono"># DRAFT</p>
        </div>
        <div className="text-right">
          <div className="flex items-start gap-6">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#4A6741] font-bold mb-1">Date</p>
              <p className="text-[13px] text-[#5F6B5A]">{today}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#4A6741] font-bold mb-1">Due</p>
              <p className="text-[13px]"><Dash /></p>
            </div>
          </div>
        </div>
      </div>

      {/* From / Bill To */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#4A6741] font-bold mb-2">From</p>
          {businessName ? (
            <p className="text-[13px] text-[#1A2318] font-medium">{businessName}</p>
          ) : (
            <p className="text-[13px]"><Dash /></p>
          )}
          <p className="text-[12px] text-[#5F6B5A] mt-0.5">{fromEmail || <Dash />}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#4A6741] font-bold mb-2">Bill To</p>
          <AnimatePresence mode="wait">
            {clientName ? (
              <motion.div
                key="client"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-[13px] text-[#1A2318] font-medium">{clientName}</p>
                <p className="text-[12px] mt-0.5"><Dash /></p>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-[13px]"><Dash /></p>
                <p className="text-[12px] mt-0.5"><Dash /></p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Line items table */}
      <div className="border-t border-[#E2E5DE] pt-4">
        <div className="grid grid-cols-[1fr_48px_64px_72px] gap-2 pb-2.5 border-b border-[#E2E5DE]">
          {['Description', 'Qty', 'Rate', 'Amount'].map(h => (
            <p key={h} className="text-[9px] uppercase tracking-widest text-[#4A6741] font-bold">{h}</p>
          ))}
        </div>
        <div className="py-4 border-b border-[#E2E5DE]">
          <p className="text-[12px] text-[#C8CEC3] italic">Items will appear as you chat…</p>
        </div>
      </div>

      {/* Totals */}
      <div className="mt-5 space-y-2">
        {[['Subtotal', null], ['Tax (0%)', null]].map(([label]) => (
          <div key={label} className="flex justify-between text-[13px]">
            <span className="text-[#5F6B5A]">{label}</span>
            <span className="font-mono text-[#C8CEC3]">—</span>
          </div>
        ))}
      </div>

      {/* Amount due block */}
      <div className="mt-5 p-4 bg-[#F4F7F3] rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#5F6B5A] uppercase tracking-widest">Amount Due</span>
          <span className="text-[24px] font-bold text-[#C8CEC3] font-mono leading-none">——</span>
        </div>
      </div>
    </div>
  );
}

// ── Preview Content ───────────────────────────────────────────────────────────

function PreviewContent({ currentInvoice, partialData, subscription, onNewInvoice, isReady }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentInvoice ? (
            <motion.div
              key="invoice-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              <InvoicePreview
                invoiceId={currentInvoice.invoice_id}
                invoiceData={currentInvoice.data || currentInvoice.invoice_data}
                invoiceStatus={currentInvoice.status || 'draft'}
                onNewInvoice={onNewInvoice}
                subscription={subscription}
              />
            </motion.div>
          ) : (
            <motion.div
              key="partial-preview"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PartialInvoiceDoc
                clientName={partialData?.clientName}
                businessName={partialData?.businessName}
                fromEmail={partialData?.fromEmail}
              />
              {/* Disabled action buttons */}
              <div className="px-6 pb-6 space-y-2">
                <button disabled className="w-full py-2.5 bg-[#C8CEC3] text-white text-[13px] font-medium rounded-lg cursor-not-allowed">
                  Send Invoice
                </button>
                <button disabled className="w-full py-2.5 border border-[#E2E5DE] text-[#C8CEC3] text-[13px] font-medium rounded-lg cursor-not-allowed">
                  Download PDF
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Close button (reusable) ───────────────────────────────────────────────────

function PaneCloseButton({ onClick }) {
  return (
    <button onClick={onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F4F7F3] text-[#8BA888] hover:text-[#1A2318] transition-colors">
      <IconClose className="w-4.5 h-4.5" />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InvoiceCreationPage({ subscription, userEmail: propEmail }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams();
  const chatRef = useRef(null);
  const { isMobile, isTablet } = useBreakpoint();

  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [userEmail, setUserEmail] = useState(propEmail || '');
  const [conversationTitle, setConversationTitle] = useState('New Invoice');
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showTabletPreview, setShowTabletPreview] = useState(false);

  // Client name for partial preview
  const initialClientName = location.state?.clientName || null;
  const [clientName, setClientName] = useState(initialClientName);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Load existing conversation when navigating to /app/invoice/:conversationId
  useEffect(() => {
    if (!conversationId) return;
    const timer = setTimeout(() => {
      if (chatRef.current) {
        loadExistingConversation(conversationId);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [conversationId]);

  // Apply client context from navigation state
  useEffect(() => {
    if (!initialClientName) return;
    const timer = setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.setCustomerContext(initialClientName);
        chatRef.current.prefillInput(`Create a new invoice for ${initialClientName}`);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [initialClientName]);

  const loadInitialData = async () => {
    // Profile (businessName, email)
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch {}

    // Email fallback
    if (!propEmail) {
      try {
        const info = await authService.getUserInfo();
        setUserEmail(info?.email || '');
      } catch {}
    }

    // Conversation history
    try {
      const data = await api.listConversations();
      const convs = Array.isArray(data) ? data : (data?.conversations || []);
      setConversations(convs.slice(0, 30));
    } catch {}
  };

  const loadExistingConversation = async (id) => {
    try {
      const data = await api.getConversation(id);
      const msgs = data?.messages || [];
      chatRef.current?.loadConversation(msgs, id);
      if (data?.client_name) {
        setConversationTitle(data.client_name);
        setClientName(data.client_name);
      }
    } catch {}
  };

  const refreshConversations = async () => {
    try {
      const data = await api.listConversations();
      const convs = Array.isArray(data) ? data : (data?.conversations || []);
      setConversations(convs.slice(0, 30));
    } catch {}
  };

  const handleInvoiceGenerated = (invoice) => {
    setCurrentInvoice(invoice);
    const name = invoice?.data?.client_name || invoice?.invoice_data?.client_name;
    if (name) {
      setConversationTitle(name);
      setClientName(name);
    }
    refreshConversations();
  };

  const handleNewInvoice = () => {
    setCurrentInvoice(null);
    setClientName(null);
    setConversationTitle('New Invoice');
    chatRef.current?.resetConversation();
    navigate('/app/invoice/new', { replace: true, state: null });
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/app');
    }
  };

  const partialData = {
    clientName,
    businessName: profile?.business_name || '',
    fromEmail: userEmail,
  };

  const initials = (profile?.business_name || userEmail || 'U')[0]?.toUpperCase() || 'U';
  const isInvoiceReady = !!currentInvoice;

  // ── Shared preview pane props ──────────────────────────────────────────────
  const previewProps = {
    currentInvoice,
    partialData,
    subscription,
    onNewInvoice: handleNewInvoice,
    isReady: isInvoiceReady,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7F3]">

      {/* ── History Rail (desktop only, lg+) ─────────────────────────────── */}
      <HistoryRail
        conversations={conversations}
        activeId={conversationId}
        userEmail={userEmail}
        initials={initials}
        onNewInvoice={handleNewInvoice}
      />

      {/* ── Chat Section (center, flex-1) ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Chat header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 bg-white border-b border-[#E2E5DE] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Mobile: back arrow */}
            <button
              onClick={handleBack}
              className="flex lg:hidden p-1.5 -ml-1.5 text-[#5F6B5A] hover:text-[#1A2318] transition-colors rounded-md"
              aria-label="Back"
            >
              <IconBack className="w-5 h-5" />
            </button>
            <h1 className="text-[15px] font-medium text-[#1A2318] truncate">{conversationTitle}</h1>
            {isInvoiceReady && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#CEDCC9] text-[#3D5636]">
                Ready
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Preview toggle — tablet + mobile */}
            {(isMobile || isTablet) && (
              <button
                onClick={() => isMobile ? setShowMobilePreview(true) : setShowTabletPreview(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F7F3] border border-[#E2E5DE] text-[#5F6B5A] hover:text-[#1A2318] text-[12.5px] font-medium rounded-lg transition-colors"
              >
                <IconDoc className="w-3.5 h-3.5" />
                Preview
              </button>
            )}
            {/* New conversation — desktop */}
            {!isMobile && !isTablet && (
              <button
                onClick={handleNewInvoice}
                className="text-[13px] text-[#8BA888] hover:text-[#5F6B5A] transition-colors"
              >
                New conversation
              </button>
            )}
          </div>
        </div>

        {/* ChatInterface — full remaining height */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            ref={chatRef}
            onInvoiceGenerated={handleInvoiceGenerated}
            viewMode="new"
            onNewInvoice={handleNewInvoice}
            onConversationActive={() => {}}
          />
        </div>
      </div>

      {/* ── Desktop Preview Pane (right, lg+) ────────────────────────────── */}
      <div className="hidden lg:flex w-[380px] flex-shrink-0 border-l border-[#E2E5DE] flex-col h-full bg-white">
        {/* Pane header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E2E5DE] flex-shrink-0">
          <span className="text-[11px] uppercase tracking-wide text-[#8A9484] font-medium">Invoice Preview</span>
          <span className={`text-[10.5px] font-medium px-2.5 py-1 rounded-full border ${
            isInvoiceReady ? 'bg-[#CEDCC9] text-[#3D5636] border-[#B5CEAF]' : 'bg-[#F4F7F3] text-[#8A9484] border-[#E2E5DE]'
          }`}>
            {isInvoiceReady ? 'Ready' : 'Draft'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PreviewContent {...previewProps} />
        </div>
      </div>

      {/* ── Tablet Preview Slide-Over ─────────────────────────────────────── */}
      <AnimatePresence>
        {isTablet && showTabletPreview && (
          <>
            <motion.div
              key="tablet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setShowTabletPreview(false)}
            />
            <motion.div
              key="tablet-preview"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed right-0 top-0 bottom-0 w-[380px] bg-white border-l border-[#E2E5DE] z-50 flex flex-col shadow-xl"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E5DE] flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] font-semibold text-[#1A2318]">Invoice Preview</span>
                  <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${
                    isInvoiceReady ? 'bg-[#CEDCC9] text-[#3D5636] border-[#B5CEAF]' : 'bg-[#F4F7F3] text-[#8A9484] border-[#E2E5DE]'
                  }`}>
                    {isInvoiceReady ? 'Ready' : 'Draft'}
                  </span>
                </div>
                <PaneCloseButton onClick={() => setShowTabletPreview(false)} />
              </div>
              <div className="flex-1 overflow-y-auto">
                <PreviewContent {...previewProps} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile Preview Bottom Sheet ───────────────────────────────────── */}
      <AnimatePresence>
        {isMobile && showMobilePreview && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50"
              onClick={() => setShowMobilePreview(false)}
            />
            <motion.div
              key="mobile-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl flex flex-col overflow-hidden"
              style={{ height: '82vh' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full bg-[#E2E5DE]" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E5DE] flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] font-semibold text-[#1A2318]">Invoice Preview</span>
                  <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${
                    isInvoiceReady ? 'bg-[#CEDCC9] text-[#3D5636] border-[#B5CEAF]' : 'bg-[#F4F7F3] text-[#8A9484] border-[#E2E5DE]'
                  }`}>
                    {isInvoiceReady ? 'Ready' : 'Draft'}
                  </span>
                </div>
                <PaneCloseButton onClick={() => setShowMobilePreview(false)} />
              </div>
              <div className="flex-1 overflow-y-auto">
                <PreviewContent {...previewProps} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
