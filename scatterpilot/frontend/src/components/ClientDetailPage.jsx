import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Badge from './ui/Badge';
import Button from './ui/Button';
import MoneyDisplay from './ui/MoneyDisplay';
import Input, { TextArea } from './ui/Input';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getAmount(inv) {
  return parseFloat(inv.total || inv.invoice_data?.total || 0);
}

function getInvoiceNumber(inv) {
  return inv.invoice_data?.invoiceNumber
    ? `#${inv.invoice_data.invoiceNumber}`
    : `#${String(inv.invoice_id || '').slice(-6).toUpperCase()}`;
}

// ── Stat block (inline, not a card) ──────────────────────────────────────────

function StatBlock({ label, children }) {
  return (
    <div>
      <p className="text-label uppercase tracking-wider text-ink-tertiary mb-1">{label}</p>
      <div className="text-body font-medium text-ink-primary">{children}</div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-20 bg-surface-hover rounded" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-surface-hover" />
          <div className="space-y-2">
            <div className="h-7 w-48 bg-surface-hover rounded" />
            <div className="h-4 w-32 bg-surface-muted rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-surface-hover rounded-button" />
          <div className="h-9 w-16 bg-surface-muted rounded-button" />
        </div>
      </div>
      <div className="flex gap-6 mt-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-16 bg-surface-muted rounded" />
            <div className="h-5 w-20 bg-surface-hover rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientDetailPage({ onClientNewInvoice }) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const customerName = decodeURIComponent(clientId || '');

  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editable contact fields
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [savedNotes, setSavedNotes] = useState('');

  useEffect(() => {
    document.title = customerName ? `${customerName} — ScatterPilot` : 'Client — ScatterPilot';
  }, [customerName]);

  useEffect(() => {
    if (customerName) fetchInvoices();
  }, [customerName]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listInvoices();
      const filtered = (res.invoices || [])
        .filter(inv => (inv.customer_name || '').toLowerCase() === customerName.toLowerCase())
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setInvoices(filtered);
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateCustomer(customerName, { phone, notes });
      setSavedPhone(phone);
      setSavedNotes(notes);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save client:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPhone(savedPhone);
    setNotes(savedNotes);
    setIsEditing(false);
  };

  // Derived stats
  const email = invoices.find(inv => inv.customer_email)?.customer_email || '';
  const totalBilled = invoices.reduce((s, inv) => s + getAmount(inv), 0);
  const outstanding = invoices
    .filter(inv => !['paid', 'cancelled'].includes(inv.status))
    .reduce((s, inv) => s + getAmount(inv), 0);
  const paid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((s, inv) => s + getAmount(inv), 0);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-body text-danger-400 mb-3">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchInvoices}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => navigate('/app/clients')}
        className="flex items-center gap-1.5 text-body text-ink-secondary hover:text-ink-primary transition-colors duration-150 mb-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 rounded"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12 19 5 12 12 5"/>
        </svg>
        Clients
      </button>

      {/* Client header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
            <span className="text-heading text-sage-600 font-medium">{getInitials(customerName)}</span>
          </div>
          <div>
            <h1 className="text-display font-bold text-ink-primary leading-tight">{customerName}</h1>
            {email && <p className="text-body text-ink-secondary mt-0.5">{email}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onClientNewInvoice?.(customerName)}>
            Invoice {customerName.split(' ')[0]}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            disabled={isEditing}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-6 flex gap-8 flex-wrap">
        <StatBlock label="Total billed">
          <MoneyDisplay amount={totalBilled} size="sm" />
        </StatBlock>
        <StatBlock label="Outstanding">
          <MoneyDisplay
            amount={outstanding}
            size="sm"
            className={outstanding > 0 ? 'text-amber-500' : undefined}
          />
        </StatBlock>
        <StatBlock label="Paid">
          <MoneyDisplay amount={paid} size="sm" />
        </StatBlock>
        <StatBlock label="Invoices">
          <span className="text-body font-medium text-ink-primary">{invoices.length}</span>
        </StatBlock>
      </div>

      {/* Invoice history */}
      <div className="mt-8">
        <h2 className="text-heading text-ink-primary mb-4">Invoice history</h2>

        {invoices.length === 0 ? (
          <div className="bg-surface-card rounded-card border border-surface-border px-6 py-10 text-center">
            <p className="text-body text-ink-secondary">No invoices yet for this client.</p>
          </div>
        ) : (
          <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-surface-muted border-b border-surface-border">
              <span className="text-label uppercase tracking-wider text-ink-tertiary">Invoice #</span>
              <span className="text-label uppercase tracking-wider text-ink-tertiary">Date</span>
              <span className="text-label uppercase tracking-wider text-ink-tertiary text-right">Amount</span>
              <span className="text-label uppercase tracking-wider text-ink-tertiary text-center">Status</span>
              <span className="text-label uppercase tracking-wider text-ink-tertiary text-right">Actions</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-surface-border">
              {invoices.map(inv => (
                <div
                  key={inv.invoice_id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-surface-hover transition-colors duration-150"
                >
                  <span className="font-mono text-body-sm text-ink-secondary">{getInvoiceNumber(inv)}</span>
                  <span className="text-body-sm text-ink-secondary whitespace-nowrap">{fmtDate(inv.invoice_date || inv.created_at)}</span>
                  <span className="text-body font-medium font-tabular text-ink-primary text-right">
                    <MoneyDisplay amount={getAmount(inv)} size="sm" />
                  </span>
                  <div className="flex justify-center">
                    <Badge status={inv.status || 'draft'}>
                      {inv.status || 'draft'}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate('/app/invoices')}
                      className="text-body-sm text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact info */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading text-ink-primary">Contact info</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-body-sm text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 rounded"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSave} loading={isSaving}>Save</Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
            </div>
          )}
        </div>

        <div className="bg-surface-card rounded-card border border-surface-border p-5 grid grid-cols-2 gap-5">
          {/* Read-only fields */}
          <div>
            <p className="text-label uppercase tracking-wider text-ink-tertiary mb-1">Name</p>
            <p className="text-body text-ink-primary">{customerName}</p>
          </div>
          <div>
            <p className="text-label uppercase tracking-wider text-ink-tertiary mb-1">Email</p>
            <p className="text-body text-ink-primary">{email || '—'}</p>
          </div>

          {/* Editable fields */}
          <div>
            {isEditing ? (
              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Add phone number"
              />
            ) : (
              <>
                <p className="text-label uppercase tracking-wider text-ink-tertiary mb-1">Phone</p>
                <p className="text-body text-ink-primary">{savedPhone || '—'}</p>
              </>
            )}
          </div>

          <div className="col-span-2">
            {isEditing ? (
              <TextArea
                label="Notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes about this client…"
                rows={3}
              />
            ) : (
              <>
                <p className="text-label uppercase tracking-wider text-ink-tertiary mb-1">Notes</p>
                <p className="text-body text-ink-primary whitespace-pre-wrap">{savedNotes || '—'}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
