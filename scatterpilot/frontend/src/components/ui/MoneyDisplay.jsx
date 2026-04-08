const sizeClasses = {
  xl: 'text-display-xl',
  lg: 'text-display-lg',
  md: 'text-heading-lg',
  sm: 'text-heading',
};

export default function MoneyDisplay({
  amount,
  size = 'md',
  currency = 'USD',
  className = '',
}) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);

  return (
    <span className={`money-display ${sizeClasses[size] ?? sizeClasses.md} ${className}`}>
      {formatted}
    </span>
  );
}
