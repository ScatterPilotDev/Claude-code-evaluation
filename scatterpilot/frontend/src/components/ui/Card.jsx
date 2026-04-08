export default function Card({
  children,
  className = '',
  hover = false,
  padding = 'default',
  onClick,
  ...props
}) {
  const paddings = {
    compact: 'p-4',
    default: 'p-5',
    spacious: 'p-6',
    none: '',
  };

  const base = `bg-surface-card rounded-card shadow-card border border-surface-border transition-all duration-150 ${paddings[padding] ?? paddings.default}`;
  const hoverStyles = hover || onClick ? 'hover:shadow-card-hover hover:border-surface-border-strong cursor-pointer' : '';

  return (
    <div
      className={`${base} ${hoverStyles} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 border-b border-surface-border ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 border-t border-surface-border ${className}`}>
      {children}
    </div>
  );
}
