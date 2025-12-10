import { motion } from 'framer-motion';

export default function Card({
  children,
  className = '',
  hover = false,
  onClick,
  ...props
}) {
  const baseStyles = 'bg-slate-800 border border-slate-700 rounded-xl shadow-lg transition-all duration-200';
  const hoverStyles = hover ? 'hover:shadow-2xl hover:border-slate-600 cursor-pointer' : '';
  const combinedClassName = `${baseStyles} ${hoverStyles} ${className}`;

  if (hover || onClick) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        className={combinedClassName}
        onClick={onClick}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={combinedClassName} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-b border-slate-700 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-t border-slate-700 ${className}`}>
      {children}
    </div>
  );
}
