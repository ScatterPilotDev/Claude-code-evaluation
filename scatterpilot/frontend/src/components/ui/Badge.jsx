const statusStyles = {
  draft: 'bg-surface-muted text-ink-secondary',
  sent: 'bg-sage-50 text-sage-600 border border-sage-200',
  paid: 'bg-success-50 text-success-500 border border-success-200',
  overdue: 'bg-danger-50 text-danger-400 border border-danger-200',
  pro: 'bg-amber-50 text-amber-600 border border-amber-200',
};

export default function Badge({ status, children, className = '' }) {
  const styles = statusStyles[status] ?? statusStyles.draft;
  return (
    <span className={`inline-flex items-center rounded-badge px-2 py-0.5 text-label-sm uppercase tracking-wider font-medium ${styles} ${className}`}>
      {children ?? status}
    </span>
  );
}
