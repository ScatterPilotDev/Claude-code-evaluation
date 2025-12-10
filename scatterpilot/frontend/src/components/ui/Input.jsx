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
  const baseStyles = 'w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900';
  const borderStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-slate-600 focus:border-purple-500 focus:ring-purple-500';
  const iconPadding = Icon ? 'pl-11' : '';

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-100">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          ref={ref}
          className={`${baseStyles} ${borderStyles} ${iconPadding} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-sm text-gray-300">{helperText}</p>
      )}
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
  const baseStyles = 'w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 resize-none';
  const borderStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-slate-600 focus:border-purple-500 focus:ring-purple-500';

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-100">
          {label}
        </label>
      )}
      <textarea
        className={`${baseStyles} ${borderStyles} ${className}`}
        rows={rows}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-sm text-gray-300">{helperText}</p>
      )}
    </div>
  );
}
