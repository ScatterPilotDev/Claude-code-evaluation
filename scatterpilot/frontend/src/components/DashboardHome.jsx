import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, PlusIcon } from '@heroicons/react/24/outline';

const STATUS_PILL = {
  paid:      'bg-green-100 text-green-700 border border-green-200',
  sent:      'bg-blue-100  text-blue-700  border border-blue-200',
  overdue:   'bg-red-100   text-red-700   border border-red-200',
  draft:     'bg-gray-100  text-gray-600  border border-gray-200',
  pending:   'bg-amber-100 text-amber-700 border border-amber-200',
  cancelled: 'bg-gray-100  text-gray-400  border border-gray-200',
};

const STATUS_LABEL = {
  paid: 'Paid', sent: 'Sent', overdue: 'Overdue',
  draft: 'Draft', pending: 'Pending', cancelled: 'Cancelled',
};

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(name) {
  if (!name?.trim()) return '';
  return name.trim().split(' ')[0];
}

// Skeleton loader for metric cards
function MetricSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-4" />
      <div className="h-9 w-36 bg-gray-200 rounded" />
    </div>
  );
}

// Skeleton for activity rows
function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="flex items-center justify-between py-3 animate-pulse">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-14 bg-gray-100 rounded-full ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardHome({
  userName,
  metrics,           // { outstanding, receivedThisMonth, overdueCount, recentActivity }
  isLoading,
  onNewInvoice,
  onInvoiceClick,
}) {
  const overdueCount = metrics?.overdueCount ?? 0;
  const recentActivity = metrics?.recentActivity ?? [];

  return (
    <div className="min-h-screen bg-cream px-4 py-10 md:px-10 md:py-14">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* ── Greeting ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-navy leading-tight">
            {getGreeting()}{userName ? `, ${getFirstName(userName)}` : ''}
          </h1>
          <p className="mt-1 text-base text-navy-light">Here's your business at a glance.</p>
        </motion.div>

        {/* ── Overdue alert ──────────────────────────── */}
        {!isLoading && overdueCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-5 py-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700"
          >
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm font-medium">
              {overdueCount} invoice{overdueCount > 1 ? 's' : ''} past due — follow up with your client{overdueCount > 1 ? 's' : ''}.
            </p>
          </motion.div>
        )}

        {/* ── Metric cards ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {isLoading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-muted mb-3">
                  Outstanding
                </p>
                <p className="text-3xl font-bold text-navy leading-none">
                  {fmt(metrics?.outstanding ?? 0)}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-muted mb-3">
                  Received This Month
                </p>
                <p className="text-3xl font-bold text-sage leading-none">
                  {fmt(metrics?.receivedThisMonth ?? 0)}
                </p>
              </motion.div>
            </>
          )}
        </div>

        {/* ── Recent activity ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-navy">Recent Activity</h2>
          </div>

          <div className="px-6 divide-y divide-gray-50">
            {isLoading ? (
              <div className="py-4"><ActivitySkeleton /></div>
            ) : recentActivity.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-navy-muted">No invoices yet — create your first one below.</p>
              </div>
            ) : (
              recentActivity.map((inv, i) => (
                <motion.button
                  key={inv.invoice_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  onClick={() => onInvoiceClick?.(inv.invoice_id, inv.client_name)}
                  className="w-full flex items-center justify-between py-4 text-left hover:bg-cream/60 transition-colors duration-150 -mx-6 px-6"
                >
                  <div>
                    <p className="text-sm font-medium text-navy">{inv.client_name || 'Unknown'}</p>
                    <p className="text-xs text-navy-muted mt-0.5">{fmtDate(inv.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-navy">{fmt(inv.amount)}</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_PILL[inv.status] ?? STATUS_PILL.draft}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </motion.div>

        {/* ── Primary CTA ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="flex justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewInvoice}
            className="flex items-center gap-2.5 px-8 py-4 bg-navy hover:bg-navy/90 text-white rounded-xl font-semibold text-base shadow-light-md transition-all duration-150"
          >
            <PlusIcon className="h-5 w-5" />
            New Invoice
          </motion.button>
        </motion.div>

      </div>
    </div>
  );
}
