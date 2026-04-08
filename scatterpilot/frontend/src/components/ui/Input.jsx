import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  icon: Icon,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const base = 'w-full px-3.5 py-2.5 bg-surface-card border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary transition-all duration-150 focus:outline-none focus:ring-1';
  const borderStyles = error
    ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-400/20'
    : 'border-surface-border focus:border-sage-500 focus:ring-sage-500/20';
  const iconPadding = Icon ? 'pl-10' : '';

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label className="block text-label uppercase tracking-wider text-ink-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          ref={ref}
          className={`${base} ${borderStyles} ${iconPadding} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-body-sm text-danger-400">{error}</p>}
      {!error && helperText && <p className="text-body-sm text-ink-tertiary">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

export function TextArea({
  label,
  error,
  helperText,
  className = '',
  containerClassName = '',
  rows = 4,
  ...props
}) {
  const base = 'w-full px-3.5 py-2.5 bg-surface-card border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary transition-all duration-150 focus:outline-none focus:ring-1 resize-none';
  const borderStyles = error
    ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-400/20'
    : 'border-surface-border focus:border-sage-500 focus:ring-sage-500/20';

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label className="block text-label uppercase tracking-wider text-ink-secondary">
          {label}
        </label>
      )}
      <textarea
        className={`${base} ${borderStyles} ${className}`}
        rows={rows}
        {...props}
      />
      {error && <p className="text-body-sm text-danger-400">{error}</p>}
      {!error && helperText && <p className="text-body-sm text-ink-tertiary">{helperText}</p>}
    </div>
  );
}
