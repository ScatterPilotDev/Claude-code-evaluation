import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Badge from './ui/Badge';
import Button from './ui/Button';
import MoneyDisplay from './ui/MoneyDisplay';
import InvoicePreview from './InvoicePreview';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILTER_STATUSES = ['all', 'draft', 'sent', 'paid', 'overdue'];

function getAmount(inv) {
  return parseFloat(inv.total || inv.invoice_data?.total || 0);
}

function getClientName(inv) {
  return (
    inv.customer_name ||
    inv.invoice_data?.billTo?.company ||
    inv.invoice_data?.billTo?.name ||
    'Unknown'
  );
}

function getInvoiceNumber(inv) {
  const num = inv.invoice_data?.invoiceNumber;
  if (num) return `INV-${String(num).padStart(4, '0')}`;
  return `INV-${String(inv.invoice_id || '').slice(-6).toUpperCase()}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

// Maps list-item status values to Badge status keys
function badgeStatus(status) {
  const map = { pending: 'sent', cancelled: 'draft' };
  return map[status] ?? status;
}

// ── Status filter tabs ────────────────────────────────────────────────────────

function FilterTab({ status, count, active, onClick }) {
  const label = status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-pill text-body-sm font-medium transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-sage-500 text-ink-inverse'
          : 'bg-surface-muted text-ink-secondary hover:bg-surface-hover',
      ].join(' ')}
    >
      {label} ({count})
    </button>
  );
}

// ── Stats summary bar ─────────────────────────────────────────────────────────

function StatsSummary({ invoices }) {
  const now = new Date();
  const mm = now.getMonth();
  const yy = now.getFullYear();

  const outstanding = invoices
    .filter(i => !['paid', 'cancelled'].includes(i.status))
    .reduce((s, i) => s + getAmount(i), 0);

  const overdue = invoices
    .filter(i => i.status === 'overdue')
    .reduce((s, i) => s + getAmount(i), 0);

  const drafts = invoices.filter(i => i.status === 'draft').length;

  const receivedMonth = invoices
    .filter(i => {
      if (i.status !== 'paid') return false;
      const d = new Date(i.updated_at || i.created_at);
      return d.getMonth() === mm && d.getFullYear() === yy;
    })
    .reduce((s, i) => s + getAmount(i), 0);

  const items = [
    { key: 'outstanding', label: 'Total outstanding', value: fmtMoney(outstanding), cls: 'text-ink-primary' },
    overdue > 0 && { key: 'overdue', label: 'Overdue', value: fmtMoney(overdue), cls: 'text-danger-400' },
    { key: 'drafts', label: 'Draft', value: `${drafts} invoice${drafts !== 1 ? 's' : ''}`, cls: 'text-ink-secondary' },
    { key: 'month', label: 'This month', value: `${fmtMoney(receivedMonth)} received`, cls: 'text-ink-secondary' },
  ].filter(Boolean);

  return (
    <div className="flex items-center flex-wrap gap-y-1 mb-6 text-body-sm">
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center">
          {i > 0 && <span className="mx-3 text-surface-border-strong select-none">·</span>}
          <span className="text-ink-tertiary">{item.label}:</span>
          <span className={`ml-1 font-medium ${item.cls}`}>{item.value}</span>
        </span>
      ))}
    </div>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="border-b border-surface-border animate-pulse">
      <td className="px-4 py-3.5"><div className="h-4 w-20 bg-surface-hover rounded font-mono" /></td>
      <td className="px-4 py-3.5"><div className="h-4 w-32 bg-surface-hover rounded" /></td>
      <td className="px-4 py-3.5"><div className="h-4 w-24 bg-surface-muted rounded" /></td>
      <td className="px-4 py-3.5 text-right"><div className="h-4 w-20 bg-surface-hover rounded ml-auto" /></td>
      <td className="px-4 py-3.5"><div className="h-5 w-14 bg-surface-muted rounded-badge mx-auto" /></td>
      <td className="px-4 py-3.5"><div className="h-4 w-16 bg-surface-muted rounded ml-auto" /></td>
    </tr>
  );
}

// ── Invoice slide-over ────────────────────────────────────────────────────────

function InvoiceSlideOver({ invoiceId, invoiceData, invoiceStatus, subscription, onClose, onNewInvoice }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-ink-primary/25 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[640px] z-50 flex flex-col shadow-modal border-l border-surface-border">
        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-3 bg-surface-card border-b border-surface-border flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Close
          </button>
          <span className="text-label uppercase tracking-wider text-ink-tertiary">Invoice detail</span>
        </div>
        {/* Scrollable preview */}
        <div className="flex-1 overflow-y-auto">
          <InvoicePreview
            invoiceId={invoiceId}
            invoiceData={invoiceData}
            invoiceStatus={invoiceStatus}
            onNewInvoice={onNewInvoice}
            subscription={subscription}
          />
        </div>
      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filtered, onNewInvoice }) {
  if (filtered) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-16 text-center text-body text-ink-secondary">
          No invoices match this filter.
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-sage-50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-sage-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <h3 className="text-heading text-ink-primary mb-2">No invoices yet</h3>
          <p className="text-body text-ink-secondary mb-6">Create your first invoice to get started</p>
          <Button onClick={onNewInvoice}>New Invoice</Button>
        </div>
      </td>
    </tr>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({ inv, onView, onMarkPaid, onCancel, visible }) {
  const canMarkPaid = ['sent', 'overdue', 'pending'].includes(inv.status);
  const canCancel   = inv.status === 'draft';

  return (
    <div className={`flex items-center justify-end gap-2 transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <button
        onClick={e => { e.stopPropagation(); onView(); }}
        className="text-body-sm text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded"
      >
        View
      </button>
      {canMarkPaid && (
        <button
          onClick={e => onMarkPaid(e, inv)}
          className="text-body-sm text-ink-secondary hover:text-success-400 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded"
          title="Mark as paid"
        >
          Mark paid
        </button>
      )}
      {canCancel && (
        <button
          onClick={e => onCancel(e, inv)}
          className="text-body-sm text-ink-secondary hover:text-danger-400 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded"
          title="Delete draft"
        >
          Delete
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicesPage({ subscription, onNewInvoice: onNewInvoiceProp }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Invoices — ScatterPilot';
  }, []);

  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [slideOver, setSlideOver] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listInvoices();
      setInvoices(
        (res.invoices || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      );
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c = { all: invoices.length, draft: 0, sent: 0, paid: 0, overdue: 0 };
    for (const inv of invoices) {
      const s = (inv.status || '').toLowerCase();
      if (s in c) c[s]++;
    }
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = activeFilter === 'all'
      ? invoices
      : invoices.filter(i => (i.status || '').toLowerCase() === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        getClientName(i).toLowerCase().includes(q) ||
        getInvoiceNumber(i).toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, activeFilter, search]);

  const handleRowClick = useCallback(async (inv) => {
    setIsLoadingDetail(true);
    try {
      const full = await api.getInvoice(inv.invoice_id);
      setSlideOver({
        invoiceId: inv.invoice_id,
        invoiceData: full.data || full.invoice_data,
        invoiceStatus: full.status || inv.status,
      });
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const handleMarkPaid = useCallback(async (e, inv) => {
    e.stopPropagation();
    try {
      await api.updateInvoiceStatus(inv.invoice_id, 'paid');
      setInvoices(prev =>
        prev.map(i => i.invoice_id === inv.invoice_id ? { ...i, status: 'paid' } : i)
      );
    } catch (err) {
      console.error('Failed to mark paid:', err);
    }
  }, []);

  const handleCancel = useCallback(async (e, inv) => {
    e.stopPropagation();
    if (!window.confirm('Delete this draft invoice?')) return;
    try {
      await api.updateInvoiceStatus(inv.invoice_id, 'cancelled');
      setInvoices(prev => prev.filter(i => i.invoice_id !== inv.invoice_id));
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  }, []);

  const handleNew = () => {
    if (onNewInvoiceProp) onNewInvoiceProp();
    else navigate('/app/invoices/new');
  };

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTER_STATUSES.map(s => (
          <FilterTab
            key={s}
            status={s}
            count={counts[s] ?? 0}
            active={activeFilter === s}
            onClick={() => setActiveFilter(s)}
          />
        ))}
      </div>

      {/* Stats summary */}
      {!isLoading && invoices.length > 0 && <StatsSummary invoices={invoices} />}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display font-bold text-ink-primary">Invoices</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoices…"
              className="w-full pl-9 pr-3.5 py-2.5 bg-surface-card border border-surface-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-1 focus:border-sage-500 focus:ring-sage-500/20 transition-all duration-150"
            />
          </div>
          <Button onClick={handleNew} loading={isLoadingDetail}>
            New Invoice
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-danger-50 border border-danger-200 rounded-card text-body-sm text-danger-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline hover:no-underline ml-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-card rounded-card shadow-card border border-surface-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-muted border-b border-surface-border">
              <th className="text-left px-4 py-3 text-label uppercase tracking-wider text-ink-tertiary">Invoice #</th>
              <th className="text-left px-4 py-3 text-label uppercase tracking-wider text-ink-tertiary">Client</th>
              <th className="text-left px-4 py-3 text-label uppercase tracking-wider text-ink-tertiary">Date</th>
              <th className="text-right px-4 py-3 text-label uppercase tracking-wider text-ink-tertiary">Amount</th>
              <th className="text-center px-4 py-3 text-label uppercase tracking-wider text-ink-tertiary">Status</th>
              <th className="text-right px-4 py-3 text-label uppercase tracking-wider text-ink-tertiary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }, (_, i) => <RowSkeleton key={i} />)
            ) : filtered.length === 0 ? (
              <EmptyState filtered={invoices.length > 0} onNewInvoice={handleNew} />
            ) : (
              filtered.map(inv => (
                <tr
                  key={inv.invoice_id}
                  onClick={() => handleRowClick(inv)}
                  onMouseEnter={() => setHoveredRow(inv.invoice_id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors duration-100 cursor-pointer"
                >
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-body-sm text-ink-secondary">
                      {getInvoiceNumber(inv)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-body font-medium text-ink-primary">
                      {getClientName(inv)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-body text-ink-secondary">
                      {fmtDate(inv.invoice_data?.invoice_date || inv.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <MoneyDisplay amount={getAmount(inv)} size="sm" className="font-medium font-tabular text-ink-primary" />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Badge status={badgeStatus(inv.status || 'draft')}>
                      {inv.status || 'draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <RowActions
                      inv={inv}
                      onView={() => handleRowClick(inv)}
                      onMarkPaid={handleMarkPaid}
                      onCancel={handleCancel}
                      visible={hoveredRow === inv.invoice_id}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      {slideOver && (
        <InvoiceSlideOver
          invoiceId={slideOver.invoiceId}
          invoiceData={slideOver.invoiceData}
          invoiceStatus={slideOver.invoiceStatus}
          subscription={subscription}
          onClose={() => setSlideOver(null)}
          onNewInvoice={handleNew}
        />
      )}

      <div className="h-8" />
    </div>
  );
}
