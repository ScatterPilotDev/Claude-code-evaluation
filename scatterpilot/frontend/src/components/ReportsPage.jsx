import { useEffect } from 'react';

// ── Chart placeholder components ─────────────────────────────────────────────

function BarChartPreview() {
  const heights = ['55%', '80%', '45%', '70%', '60%', '85%', '50%'];
  return (
    <div className="h-[200px] bg-surface-muted rounded-lg flex items-end justify-around px-6 py-4 border border-dashed border-surface-border">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 mx-1 rounded-t-sm bg-sage-200"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function LineChartPreview() {
  return (
    <div className="h-[200px] bg-surface-muted rounded-lg relative overflow-hidden border border-dashed border-surface-border">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 300 160"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        {[40, 80, 120].map(y => (
          <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#E2E5DE" strokeWidth="1" />
        ))}
        {/* Area fill */}
        <path
          d="M0,130 C30,110 50,60 80,80 C110,100 130,35 165,55 C195,75 215,40 245,50 C270,58 290,45 300,52 L300,160 L0,160 Z"
          fill="rgba(74,103,65,0.08)"
        />
        {/* Line */}
        <path
          d="M0,130 C30,110 50,60 80,80 C110,100 130,35 165,55 C195,75 215,40 245,50 C270,58 290,45 300,52"
          fill="none"
          stroke="rgba(74,103,65,0.45)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {[[80,80],[165,55],[245,50]].map(([cx,cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill="rgba(74,103,65,0.5)" />
        ))}
      </svg>
    </div>
  );
}

function AgingFunnelPreview() {
  const stages = [
    { label: 'Current',  pct: 100, cls: 'bg-sage-200' },
    { label: '30 days',  pct: 66,  cls: 'bg-amber-200' },
    { label: '60 days',  pct: 38,  cls: 'bg-amber-300' },
    { label: '90+ days', pct: 18,  cls: 'bg-danger-200' },
  ];
  return (
    <div className="h-[200px] bg-surface-muted rounded-lg flex flex-col justify-center gap-3 px-6 border border-dashed border-surface-border">
      {stages.map(({ label, pct, cls }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-label text-ink-tertiary w-16 text-right shrink-0">{label}</span>
          <div
            className={`h-7 rounded-sm ${cls} opacity-70 transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function TaxDocPreview() {
  return (
    <div className="h-[200px] bg-surface-muted rounded-lg flex flex-col items-center justify-center gap-4 border border-dashed border-surface-border">
      <svg
        className="w-10 h-10 text-ink-tertiary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
      <div className="flex flex-col gap-2 items-center">
        <div className="h-2 w-32 bg-surface-border rounded-full" />
        <div className="h-2 w-24 bg-surface-border rounded-full" />
        <div className="h-2 w-28 bg-surface-border rounded-full" />
      </div>
    </div>
  );
}

// ── Report card wrapper ───────────────────────────────────────────────────────

function ReportCard({ title, description, children }) {
  return (
    <div className="bg-surface-card rounded-card shadow-card border border-surface-border p-6">
      <h2 className="text-heading text-ink-primary mb-1">{title}</h2>
      <p className="text-body-sm text-ink-secondary mb-4">{description}</p>
      {children}
      <p className="text-body-sm text-ink-tertiary mt-3">Available soon</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  useEffect(() => {
    document.title = 'Reports — ScatterPilot';
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-display text-ink-primary">Reports</h1>
        <p className="text-body-lg text-ink-secondary mt-2">
          Business insights and analytics — coming soon.
        </p>
      </div>

      {/* Preview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ReportCard
          title="Revenue by Client"
          description="See which clients contribute most to your bottom line"
        >
          <BarChartPreview />
        </ReportCard>

        <ReportCard
          title="Monthly Trends"
          description="Track income over time and spot seasonal patterns"
        >
          <LineChartPreview />
        </ReportCard>

        <ReportCard
          title="Invoice Aging"
          description="Monitor how long outstanding invoices have been open"
        >
          <AgingFunnelPreview />
        </ReportCard>

        <ReportCard
          title="Tax Summary"
          description="Year-end income and tax reporting, ready to export"
        >
          <TaxDocPreview />
        </ReportCard>
      </div>

      {/* CTA */}
      <div className="mt-10 text-center">
        <a
          href="mailto:hello@scatterpilot.com?subject=Reports%20feature%20request"
          className="text-body text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 rounded"
        >
          Want this sooner? Let us know →
        </a>
      </div>

      <div className="h-8" />
    </div>
  );
}
