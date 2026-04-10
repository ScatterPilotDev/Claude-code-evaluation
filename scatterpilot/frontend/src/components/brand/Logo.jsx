/**
 * ScatterPilot Logo System
 *
 * Variants: 'mark' | 'wordmark' | 'compact'
 * Sizes:    'sm' (24px) | 'md' (32px) | 'lg' (48px) | 'xl' (64px)
 * Colors:   'default' (sage mark on white/light) | 'white' (all-white for dark bg) | 'dark' (sage-900 bg)
 *
 * The mark is a geometric 3-bar S-form — built on a grid, reads at any size from 16px up.
 */

const MARK_SIZES = { sm: 24, md: 32, lg: 48, xl: 64 };
const TEXT_SIZES = { sm: 14, md: 16, lg: 22, xl: 28 };
const GAP_SIZES  = { sm: 6,  md: 7,  lg: 10, xl: 12 };

const MARK_COLORS = {
  default: { bg: '#4A6741', bars: '#FFFFFF' },
  white:   { bg: 'none',   bars: '#FFFFFF' },
  dark:    { bg: '#1A2318', bars: '#FFFFFF' },
};

const TEXT_COLORS = {
  default: { scatter: '#1A2318', pilot: '#4A6741' },
  white:   { scatter: '#FFFFFF', pilot: 'rgba(255,255,255,0.75)' },
  dark:    { scatter: '#1A2318', pilot: '#4A6741' },
};

/**
 * The geometric mark SVG — a 3-bar S-form built on a 32×32 grid.
 *
 * Three horizontally-alternating bars:
 *   Top  bar — right-aligned → x 10–26
 *   Mid  bar — left-aligned  → x  6–22
 *   Bot  bar — right-aligned → x 10–26
 *
 * The offset creates the S-curve through negative space.
 */
function Mark({ size = 'md', color = 'default' }) {
  const px = MARK_SIZES[size];
  const { bg, bars } = MARK_COLORS[color];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background rounded square */}
      {bg !== 'none' && (
        <rect width="32" height="32" rx="7" fill={bg} />
      )}

      {/* Top bar — right-aligned */}
      <rect x="10" y="5.5" width="16" height="5" rx="2" fill={bars} />

      {/* Middle bar — left-aligned (creates S-curve negative space) */}
      <rect x="6"  y="13.5" width="16" height="5" rx="2" fill={bars} />

      {/* Bottom bar — right-aligned */}
      <rect x="10" y="21.5" width="16" height="5" rx="2" fill={bars} />
    </svg>
  );
}

/**
 * Wordmark: mark + "ScatterPilot" text
 */
function Wordmark({ size = 'md', color = 'default', className }) {
  const markPx = MARK_SIZES[size];
  const textPx = TEXT_SIZES[size];
  const gap    = GAP_SIZES[size];
  const { scatter, pilot } = TEXT_COLORS[color];

  return (
    <span
      className={`inline-flex items-center ${className || ''}`}
      style={{ gap }}
    >
      <Mark size={size} color={color} />
      <span
        style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: textPx,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: scatter }}>Scatter</span>
        <span style={{ color: pilot }}>Pilot</span>
      </span>
    </span>
  );
}

/**
 * Compact: mark + "SP" abbreviation
 */
function Compact({ size = 'md', color = 'default', className }) {
  const markPx = MARK_SIZES[size];
  const textPx = Math.round(TEXT_SIZES[size] * 0.8);
  const gap    = GAP_SIZES[size] - 2;
  const { scatter } = TEXT_COLORS[color];

  return (
    <span
      className={`inline-flex items-center ${className || ''}`}
      style={{ gap }}
    >
      <Mark size={size} color={color} />
      <span
        style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: textPx,
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1,
          color: scatter,
          whiteSpace: 'nowrap',
        }}
      >
        SP
      </span>
    </span>
  );
}

/**
 * Main Logo component
 */
export default function Logo({
  variant  = 'wordmark',
  size     = 'md',
  color    = 'default',
  className = '',
}) {
  if (variant === 'mark')    return <Mark    size={size} color={color} />;
  if (variant === 'compact') return <Compact size={size} color={color} className={className} />;
  return                            <Wordmark size={size} color={color} className={className} />;
}
