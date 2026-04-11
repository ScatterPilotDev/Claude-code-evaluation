import { useEffect } from 'react';
import MoneyDisplay from './ui/MoneyDisplay';
import Badge from './ui/Badge';
import Button from './ui/Button';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return inv.invoice_data?.invoiceNumber
    ? `#${inv.invoice_data.invoiceNumber}`
    : `#${String(inv.invoice_id || '').slice(-6).toUpperCase()}`;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function MetricCardSkeleton({ wide }) {
  return (
    <div className={`bg-surface-card rounded-card border border-surface-border p-6 animate-pulse ${wide ? 'sm:flex-[2]' : 'sm:flex-1'}`}>
      <div className="h-3 w-28 bg-surface-hover rounded mb-4" />
      <div className="h-10 w-36 bg-surface-hover rounded mb-2" />
      <div className="h-3 w-20 bg-surface-muted rounded" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface-card rounded-card border border-surface-border animate-pulse">
      <div className="h-6 w-14 bg-surface-hover rounded-badge" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 bg-surface-hover rounded" />
        <div className="h-3 w-20 bg-surface-muted rounded" />
      </div>
      <div className="h-5 w-20 bg-surface-hover rounded" />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNewInvoice }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="mb-6">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="72" height="72" rx="36" className="fill-sage-100"/>
          <path d="M24 20h16l8 8v24a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2V22a2 2 0 0 1 2-2z" className="stroke-sage-500" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M40 20v8h8" className="stroke-sage-500" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="36" y1="34" x2="36" y2="44" className="stroke-sage-500" strokeWidth="1.75" strokeLinecap="round"/>
          <line x1="31" y1="39" x2="41" y2="39" className="stroke-sage-500" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
      </div>
      <h1 className="text-display text-ink-primary mb-3">Send your first invoice</h1>
      <p className="text-body-lg text-ink-secondary max-w-sm mb-8">
        ScatterPilot makes invoicing as easy as a conversation. Start by creating your first invoice.
      </p>
      <Button size="lg" onClick={onNewInvoice}>
        Create Invoice
      </Button>
    </div>
  );
}

// ── Zone 1: Metric cards ──────────────────────────────────────────────────────

function MetricCards({ invoices }) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const owedInvoices = invoices.filter(i => ['sent', 'pending', 'overdue'].includes(i.status));
  const youAreOwed = owedInvoices.reduce((s, i) => s + getAmount(i), 0);

  const paidThisMonth = invoices.filter(i => {
    if (i.status !== 'paid') return false;
    const d = new Date(i.updated_at || i.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const receivedThisMonth = paidThisMonth.reduce((s, i) => s + getAmount(i), 0);

  const overdueInvoices = invoices.filter(i => {
    if (['paid', 'cancelled'].includes(i.status)) return false;
    if (i.status === 'overdue') return true;
    const due = i.invoice_data?.due_date || i.invoice_data?.dueDate;
    return due && new Date(due) < now;
  });
  const overdueAmount = overdueInvoices.reduce((s, i) => s + getAmount(i), 0);
  const hasOverdue = overdueInvoices.length > 0;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* You're owed — primary, ~50% */}
      <div className="sm:flex-[2] bg-surface-card rounded-card shadow-card border border-surface-border p-6">
        <p className="text-label uppercase tracking-wider text-ink-tertiary mb-3">You're owed</p>
        <MoneyDisplay amount={youAreOwed} size="xl" className="text-ink-primary" />
        <p className="mt-2 text-body-sm text-ink-tertiary">
          from {owedInvoices.length} invoice{owedInvoices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Received this month — ~25% */}
      <div className="sm:flex-1 bg-surface-card rounded-card shadow-card border border-surface-border p-6">
        <p className="text-label uppercase tracking-wider text-ink-tertiary mb-3">Received this month</p>
        <MoneyDisplay amount={receivedThisMonth} size="lg" className="text-ink-primary" />
        <p className="mt-2 text-body-sm text-ink-tertiary">
          {paidThisMonth.length} payment{paidThisMonth.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Overdue — ~25%, accent left border if overdue */}
      <div className={[
        'sm:flex-1 bg-surface-card rounded-card shadow-card border border-surface-border p-6',
        hasOverdue ? 'border-l-4 border-l-danger-400' : '',
      ].join(' ')}>
        <p className="text-label uppercase tracking-wider text-ink-tertiary mb-3">Overdue</p>
        <MoneyDisplay
          amount={overdueAmount}
          size="lg"
          className={hasOverdue ? 'text-danger-400' : 'text-ink-primary'}
        />
        <p className="mt-2 text-body-sm">
          {hasOverdue
            ? <span className="text-danger-400">{overdueInvoices.length} need{overdueInvoices.length === 1 ? 's' : ''} attention</span>
            : <span className="text-success-400">All clear</span>
          }
        </p>
      </div>
    </div>
  );
}

// ── Zone 2: Needs attention ───────────────────────────────────────────────────

function NeedsAttention({ invoices, onInvoiceClick, onNewInvoice, onClientNewInvoice }) {
  const now = new Date();

  const attention = invoices.filter(i => {
    if (['paid', 'cancelled', 'draft'].includes(i.status)) return false;
    if (i.status === 'overdue') return true;
    if (i.status === 'sent' || i.status === 'pending') return true;
    const due = i.invoice_data?.due_date || i.invoice_data?.dueDate;
    return due && new Date(due) < now;
  }).sort((a, b) => {
    // overdue first, then by date
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Recent unique clients for quick-action chips (last 4)
  const recentClients = [];
  const seen = new Set();
  for (const inv of [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    const name = getClientName(inv);
    if (!seen.has(name) && name !== 'Unknown') {
      seen.add(name);
      recentClients.push(name);
      if (recentClients.length === 4) break;
    }
  }

  return (
    <div>
      <h2 className="text-heading text-ink-primary mb-4 mt-8">Needs attention</h2>

      {attention.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-4 bg-surface-card rounded-card border border-surface-border">
          <div className="w-8 h-8 rounded-full bg-success-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-success-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-body text-ink-secondary">You're all caught up</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attention.map(inv => (
            <div
              key={inv.invoice_id}
              className="flex items-center gap-3 px-4 py-3 bg-surface-card rounded-card border border-surface-border"
            >
              <Badge status={inv.status === 'pending' ? 'sent' : inv.status} />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-ink-primary truncate">{getClientName(inv)}</p>
                <p className="text-body-sm text-ink-tertiary font-mono">{getInvoiceNumber(inv)}</p>
              </div>
              <MoneyDisplay amount={getAmount(inv)} size="sm" className="flex-shrink-0 text-ink-primary" />
              <Button
                variant="secondary"
                size="sm"
                className="flex-shrink-0"
                onClick={() => onInvoiceClick?.(inv.invoice_id, getClientName(inv))}
              >
                {inv.status === 'overdue' ? 'Send reminder' : 'Follow up'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <Button size="sm" onClick={onNewInvoice}>New Invoice</Button>
        {recentClients.map(name => (
          <button
            key={name}
            onClick={() => onClientNewInvoice?.(name)}
            className="bg-surface-muted hover:bg-surface-hover border border-surface-border rounded-pill px-3 py-1.5 text-body-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Zone 3: Recent activity ───────────────────────────────────────────────────

function ActivityDot({ status }) {
  if (status === 'paid') {
    return <div className="w-2 h-2 rounded-full bg-success-400 flex-shrink-0 mt-1.5" />;
  }
  if (status === 'overdue') {
    return <div className="w-2 h-2 rounded-full bg-danger-400 flex-shrink-0 mt-1.5" />;
  }
  if (status === 'sent' || status === 'pending') {
    return <div className="w-2 h-2 rounded-full bg-sage-400 flex-shrink-0 mt-1.5" />;
  }
  return <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />;
}

function activityDescription(inv) {
  const client = getClientName(inv);
  const num = getInvoiceNumber(inv);
  switch (inv.status) {
    case 'paid':    return `Payment received from ${client}`;
    case 'sent':    return `Invoice ${num} sent to ${client}`;
    case 'overdue': return `Invoice ${num} overdue — ${client}`;
    default:        return `Invoice ${num} created for ${client}`;
  }
}

function RecentActivity({ invoices, onInvoiceClick }) {
  // Build events: one per invoice, sorted by most-recent date
  const events = [...invoices]
    .map(inv => ({
      inv,
      date: inv.status === 'paid'
        ? (inv.updated_at || inv.created_at)
        : inv.created_at,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  return (
    <div>
      <h2 className="text-heading text-ink-primary mt-8 mb-4">Recent activity</h2>
      <div className="bg-surface-card rounded-card border border-surface-border divide-y divide-surface-border">
        {events.length === 0 ? (
          <p className="text-body text-ink-tertiary text-center py-8">No activity yet</p>
        ) : (
          events.map(({ inv, date }) => (
            <button
              key={inv.invoice_id}
              onClick={() => onInvoiceClick?.(inv.invoice_id, getClientName(inv))}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage-500"
            >
              <ActivityDot status={inv.status} />
              <p className="flex-1 text-body text-ink-primary">{activityDescription(inv)}</p>
              <span className="text-body-sm text-ink-tertiary flex-shrink-0">{relativeTime(date)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function DashboardHome({
  userName,
  invoices = [],
  isLoading,
  onNewInvoice,
  onInvoiceClick,
  onClientNewInvoice,
}) {
  useEffect(() => {
    document.title = 'Home — ScatterPilot';
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <MetricCardSkeleton wide />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
        <div className="h-6 w-40 bg-surface-hover rounded mt-8 animate-pulse" />
        <div className="flex flex-col gap-3">
          <RowSkeleton />
          <RowSkeleton />
        </div>
        <div className="h-6 w-40 bg-surface-hover rounded mt-8 animate-pulse" />
        <div className="bg-surface-card rounded-card border border-surface-border divide-y divide-surface-border">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-surface-hover flex-shrink-0" />
              <div className="flex-1 h-4 bg-surface-hover rounded" />
              <div className="w-16 h-3 bg-surface-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return <EmptyState onNewInvoice={onNewInvoice} />;
  }

  return (
    <div>
      {/* Zone 1 — Money */}
      <MetricCards invoices={invoices} />

      {/* Zone 2 — Actions */}
      <NeedsAttention
        invoices={invoices}
        onInvoiceClick={onInvoiceClick}
        onNewInvoice={onNewInvoice}
        onClientNewInvoice={onClientNewInvoice}
      />

      {/* Zone 3 — Activity */}
      <RecentActivity invoices={invoices} onInvoiceClick={onInvoiceClick} />

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}
