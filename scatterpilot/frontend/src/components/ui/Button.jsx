import { forwardRef } from 'react';

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-button transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-ink-inverse shadow-card',
    secondary: 'border border-surface-border hover:border-sage-500 bg-surface-card text-ink-primary hover:text-sage-600',
    ghost: 'bg-transparent hover:bg-surface-hover text-ink-secondary hover:text-ink-primary',
    danger: 'bg-danger-400 hover:bg-danger-500 text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-body-sm gap-1.5',
    md: 'px-4 py-2.5 text-body gap-2',
    lg: 'px-6 py-3 text-body-lg gap-2.5',
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
