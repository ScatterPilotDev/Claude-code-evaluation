import { useState, useEffect } from 'react';
import api from '../services/api';
import { canAccessFeature } from '../utils/planAccess';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function fmtMonth(yyyyMM) {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

// ── Report Card shell ─────────────────────────────────────────────────────────

function ReportCard({ title, stat, statLabel, children }) {
  return (
    <div className="bg-surface-card rounded-card shadow-card border border-surface-border p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-heading text-ink-primary">{title}</h2>
        {stat !== undefined && (
          <p className="text-display font-bold text-sage-600 mt-1">{stat}</p>
        )}
        {statLabel && <p className="text-body-sm text-ink-secondary">{statLabel}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Chart 1: Revenue by Client (horizontal bar) ───────────────────────────────

function RevenueByClientChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-body-sm text-ink-tertiary py-8 text-center">No client revenue data yet.</p>;
  }
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="space-y-2.5">
      {data.slice(0, 8).map(({ client, total }) => (
        <div key={client} className="flex items-center gap-3">
          <span className="text-body-sm text-ink-secondary w-28 truncate shrink-0 text-right">{client}</span>
          <div className="flex-1 bg-surface-muted rounded-full h-6 overflow-hidden">
            <div
              className="h-full bg-sage-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max((total / max) * 100, 2)}%` }}
            />
          </div>
          <span className="text-body-sm font-medium text-ink-primary w-20 shrink-0">{fmt(total)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Chart 2: Monthly Revenue Trend (bar chart) ────────────────────────────────

function MonthlyTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-body-sm text-ink-tertiary py-8 text-center">No monthly data yet.</p>;
  }
  const maxVal = Math.max(...data.flatMap(d => [d.invoiced, d.received]), 1);
  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-label text-ink-secondary">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-sage-300" />Invoiced</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-sage-500" />Received</span>
      </div>
      {/* Bars */}
      <div className="flex items-end gap-1.5 h-40">
        {data.map(({ month, invoiced, received }) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div className="w-full flex items-end gap-0.5 h-32">
              <div
                className="flex-1 bg-sage-200 rounded-t-sm"
                style={{ height: `${Math.max((invoiced / maxVal) * 100, 2)}%` }}
                title={`Invoiced: ${fmt(invoiced)}`}
              />
              <div
                className="flex-1 bg-sage-500 rounded-t-sm"
                style={{ height: `${Math.max((received / maxVal) * 100, 2)}%` }}
                title={`Received: ${fmt(received)}`}
              />
            </div>
            <span className="text-[10px] text-ink-tertiary truncate w-full text-center">{fmtMonth(month)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chart 3: Invoice Status Breakdown ────────────────────────────────────────

function StatusBreakdownChart({ data }) {
  if (!data) return null;
  const items = [
    { label: 'Paid',    value: data.paid,    color: 'bg-success-500' },
    { label: 'Sent',    value: data.sent,    color: 'bg-sage-400' },
    { label: 'Overdue', value: data.overdue, color: 'bg-danger-400' },
    { label: 'Draft',   value: data.draft,   color: 'bg-surface-border-strong' },
  ];
  const total = items.reduce((s, i) => s + (i.value || 0), 0) || 1;
  return (
    <div className="space-y-3">
      {/* Segmented bar */}
      <div className="flex h-4 rounded-full overflow-hidden w-full">
        {items.filter(i => i.value > 0).map(({ label, value, color }) => (
          <div
            key={label}
            className={`${color}`}
            style={{ width: `${(value / total) * 100}%` }}
            title={`${label}: ${value}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
            <span className="text-body-sm text-ink-secondary">{label}</span>
            <span className="text-body-sm font-medium text-ink-primary ml-auto">{value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chart 4: Outstanding Aging ────────────────────────────────────────────────

function AgingChart({ data }) {
  if (!data) return null;
  const buckets = [
    { label: 'Current',  key: 'current', color: 'bg-sage-400' },
    { label: '1–30 days', key: '1_30',   color: 'bg-amber-300' },
    { label: '31–60 days', key: '31_60', color: 'bg-amber-400' },
    { label: '61–90 days', key: '61_90', color: 'bg-orange-400' },
    { label: '90+ days', key: '90_plus', color: 'bg-danger-400' },
  ];
  const max = Math.max(...buckets.map(b => data[b.key] || 0), 1);
  return (
    <div className="space-y-2.5">
      {buckets.map(({ label, key, color }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-body-sm text-ink-secondary w-24 shrink-0 text-right">{label}</span>
          <div className="flex-1 bg-surface-muted rounded-full h-6 overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-500`}
              style={{ width: `${Math.max(((data[key] || 0) / max) * 100, data[key] > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="text-body-sm font-medium text-ink-primary w-6 shrink-0 text-right">{data[key] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

// ── Upgrade overlay ───────────────────────────────────────────────────────────

function UpgradeOverlay() {
  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="select-none pointer-events-none blur-sm opacity-40">
        <div className="space-y-2.5">
          {['Acme Corp', 'Bright Ideas LLC', 'Pixel Studio', 'Wave Agency'].map((c, i) => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-body-sm text-ink-secondary w-28 text-right">{c}</span>
              <div className="flex-1 bg-surface-muted rounded-full h-6 overflow-hidden">
                <div className="h-full bg-sage-300 rounded-full" style={{ width: `${[85, 60, 40, 25][i]}%` }} />
              </div>
              <span className="text-body-sm font-medium text-ink-primary w-20">{['$12,400', '$8,200', '$5,100', '$3,300'][i]}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Overlay CTA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-card/80 backdrop-blur-[2px] rounded-lg">
        <p className="text-heading text-ink-primary font-semibold">Upgrade to Pro</p>
        <p className="text-body-sm text-ink-secondary text-center max-w-xs">
          Unlock full analytics — revenue by client, monthly trends, aging reports, and more.
        </p>
        <a
          href="/app/pricing"
          className="px-5 py-2.5 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-medium text-body transition-colors duration-150"
        >
          View plans →
        </a>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse h-32 bg-surface-muted rounded-lg" />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage({ billingStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasAccess = canAccessFeature(billingStatus, 'reports');

  useEffect(() => {
    document.title = 'Reports — ScatterPilot';
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    api.getReportsSummary()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [hasAccess]);

  const totalInvoiced = data?.totals?.allTime ?? 0;
  const totalPaid = data?.totals?.paid ?? 0;
  const totalOutstanding = data?.totals?.outstanding ?? 0;
  const totalInvoices = Object.values(data?.statusBreakdown ?? {}).reduce((s, v) => s + v, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-display text-ink-primary">Reports</h1>
        <p className="text-body-lg text-ink-secondary mt-2">
          Business insights and analytics.
        </p>
      </div>

      {/* Summary strip */}
      {hasAccess && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Invoiced', value: fmt(totalInvoiced) },
            { label: 'Total Received', value: fmt(totalPaid) },
            { label: 'Outstanding',    value: fmt(totalOutstanding) },
            { label: 'Total Invoices', value: totalInvoices },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-card rounded-card border border-surface-border p-4">
              <p className="text-label text-ink-tertiary uppercase tracking-wide">{label}</p>
              <p className="text-heading-lg font-bold text-ink-primary mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-card p-4 mb-6">
          <p className="text-body-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Report cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Revenue by Client */}
        <ReportCard
          title="Revenue by Client"
          stat={hasAccess && data ? `${data.revenueByClient?.length ?? 0} clients` : undefined}
          statLabel="sorted by total billed"
        >
          {!hasAccess ? (
            <UpgradeOverlay />
          ) : loading ? (
            <Skeleton />
          ) : (
            <RevenueByClientChart data={data?.revenueByClient} />
          )}
        </ReportCard>

        {/* Monthly Trend */}
        <ReportCard
          title="Monthly Revenue"
          stat={hasAccess && data ? fmt(data.monthlyTrend?.slice(-1)[0]?.received ?? 0) : undefined}
          statLabel="received this month"
        >
          {!hasAccess ? (
            <UpgradeOverlay />
          ) : loading ? (
            <Skeleton />
          ) : (
            <MonthlyTrendChart data={data?.monthlyTrend} />
          )}
        </ReportCard>

        {/* Status Breakdown */}
        <ReportCard
          title="Invoice Status"
          stat={hasAccess && data ? totalInvoices : undefined}
          statLabel="total invoices"
        >
          {!hasAccess ? (
            <UpgradeOverlay />
          ) : loading ? (
            <Skeleton />
          ) : (
            <StatusBreakdownChart data={data?.statusBreakdown} />
          )}
        </ReportCard>

        {/* Aging */}
        <ReportCard
          title="Outstanding Aging"
          stat={hasAccess && data ? data?.agingBuckets?.['90_plus'] ?? 0 : undefined}
          statLabel="invoices 90+ days overdue"
        >
          {!hasAccess ? (
            <UpgradeOverlay />
          ) : loading ? (
            <Skeleton />
          ) : (
            <AgingChart data={data?.agingBuckets} />
          )}
        </ReportCard>
      </div>

      <div className="h-8" />
    </div>
  );
}
