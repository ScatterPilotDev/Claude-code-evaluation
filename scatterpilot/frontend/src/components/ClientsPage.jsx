import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Button from './ui/Button';
import MoneyDisplay from './ui/MoneyDisplay';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Client Card ───────────────────────────────────────────────────────────────

function ClientCard({ client, onInvoice, onClick }) {
  const hasOutstanding = client.outstanding > 0;

  return (
    <div
      onClick={onClick}
      className="bg-surface-card rounded-card shadow-card border border-surface-border hover:shadow-card-hover hover:border-surface-border-strong transition-all duration-150 cursor-pointer p-5"
    >
      {/* Name + email */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
          <span className="text-body font-medium text-sage-600">{getInitials(client.customer_name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-heading-sm font-medium text-ink-primary truncate">{client.customer_name}</p>
          {client.email
            ? <p className="text-body-sm text-ink-tertiary truncate mt-0.5">{client.email}</p>
            : <p className="text-body-sm text-ink-tertiary mt-0.5">{client.invoice_count} invoice{client.invoice_count !== 1 ? 's' : ''}</p>
          }
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-surface-border my-3" />

      {/* Stats */}
      <div className="flex justify-between">
        <div>
          <p className="text-label uppercase tracking-wider text-ink-tertiary">Total billed</p>
          <p className="text-body font-medium font-tabular text-ink-primary mt-0.5">
            <MoneyDisplay amount={client.total_revenue} size="sm" />
          </p>
        </div>
        <div className="text-right">
          <p className="text-label uppercase tracking-wider text-ink-tertiary">Outstanding</p>
          <p className={`text-body font-medium font-tabular mt-0.5 ${hasOutstanding ? 'text-amber-500' : 'text-ink-tertiary'}`}>
            <MoneyDisplay amount={client.outstanding} size="sm" className={hasOutstanding ? 'text-amber-500' : 'text-ink-tertiary'} />
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex justify-between items-center">
        <span className="text-body-sm text-ink-tertiary">
          {client.lastInvoiceDate ? `Last invoice: ${client.lastInvoiceDate}` : 'No invoices yet'}
        </span>
        <Button
          size="sm"
          onClick={e => { e.stopPropagation(); onInvoice(client.customer_name); }}
        >
          Invoice
        </Button>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-surface-card rounded-card border border-surface-border p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-hover" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-surface-hover rounded" />
          <div className="h-3 w-24 bg-surface-muted rounded" />
        </div>
      </div>
      <div className="border-t border-surface-border my-3" />
      <div className="flex justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-surface-muted rounded" />
          <div className="h-4 w-20 bg-surface-hover rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-surface-muted rounded" />
          <div className="h-4 w-20 bg-surface-hover rounded" />
        </div>
      </div>
      <div className="mt-3 flex justify-between items-center">
        <div className="h-3 w-28 bg-surface-muted rounded" />
        <div className="h-7 w-16 bg-surface-hover rounded-button" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyClients({ onNewInvoice }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-sage-50 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-sage-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <h2 className="text-heading text-ink-primary mb-2">No clients yet</h2>
      <p className="text-body text-ink-secondary mb-6">
        Clients are added automatically when you create your first invoice.
      </p>
      <Button onClick={onNewInvoice}>Create an invoice</Button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage({ onClientNewInvoice }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Clients — ScatterPilot';
  }, []);

  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [custRes, invRes] = await Promise.all([
        api.listCustomers(),
        api.listInvoices(),
      ]);
      setCustomers(custRes.customers || []);
      setInvoices(invRes.invoices || []);
    } catch (err) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  // Enrich customers with invoice-derived data
  const enriched = useMemo(() => {
    return customers.map(c => {
      const clientInvoices = invoices.filter(
        inv => (inv.customer_name || '').toLowerCase() === c.customer_name.toLowerCase()
      );
      const outstanding = clientInvoices
        .filter(inv => !['paid', 'cancelled'].includes(inv.status))
        .reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
      const sorted = [...clientInvoices].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      const email = sorted.find(inv => inv.customer_email)?.customer_email || '';
      const lastInvoiceDate = sorted[0] ? fmtDate(sorted[0].created_at) : null;

      return {
        ...c,
        total_revenue: parseFloat(c.total_revenue || 0),
        outstanding,
        email,
        lastInvoiceDate,
      };
    }).sort((a, b) => b.total_revenue - a.total_revenue);
  }, [customers, invoices]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return enriched;
    return enriched.filter(c =>
      c.customer_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [enriched, search]);

  const handleClientClick = (customer) => {
    navigate(`/app/clients/${encodeURIComponent(customer.customer_name)}`);
  };

  const handleNewInvoice = () => navigate('/app/invoices');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display font-bold text-ink-primary">Clients</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleNewInvoice}
          icon={() => (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
        >
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 w-full md:max-w-[400px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full pl-9 pr-3.5 py-2.5 bg-surface-card border border-surface-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-1 focus:border-sage-500 focus:ring-sage-500/20 transition-all duration-150"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-danger-50 border border-danger-200 rounded-card text-body-sm text-danger-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline hover:no-underline ml-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded">Retry</button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : enriched.length === 0 ? (
        <EmptyClients onNewInvoice={handleNewInvoice} />
      ) : filtered.length === 0 ? (
        <p className="text-body text-ink-secondary py-12 text-center">
          No clients match "{search}"
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard
              key={client.customer_name}
              client={client}
              onInvoice={name => onClientNewInvoice?.(name)}
              onClick={() => handleClientClick(client)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
