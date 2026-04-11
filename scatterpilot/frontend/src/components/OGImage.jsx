/**
 * OGImage — visual reference for the Open Graph social share image.
 *
 * This component renders the same layout as public/og-image.svg so designers
 * can preview and iterate in the browser. To regenerate og-image.png:
 *
 *   1. Run the dev server: npm run dev
 *   2. Navigate to /og-preview (add a temporary route if needed)
 *   3. Screenshot the 1200×630 element, or use a headless tool:
 *        npx playwright screenshot --viewport-size=1200,630 http://localhost:5173/og-preview og-image.png
 *
 * TODO: Wire up a Vite build plugin (e.g. vite-plugin-svg2png) to auto-convert
 *       public/og-image.svg → public/og-image.png on every build.
 */

// Design tokens (matches tailwind.config.js)
const COLORS = {
  bg:          '#FAFBF9',
  sage50:      '#F4F7F3',
  sage200:     '#CEDCC9',
  sage500:     '#4A6741',
  inkPrimary:  '#1A2318',
  inkSecond:   '#5F6B5A',
  border:      '#E2E5DE',
};

// The geometric S-mark, scaled to targetSize px
function Mark({ size = 96 }) {
  const scale = size / 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <rect width="32" height="32" rx="7" fill={COLORS.sage500} />
      {/* Top bar — right-aligned */}
      <rect x="10" y="5.5"  width="16" height="5" rx="2" fill="#fff" />
      {/* Middle bar — left-aligned */}
      <rect x="6"  y="13.5" width="16" height="5" rx="2" fill="#fff" />
      {/* Bottom bar — right-aligned */}
      <rect x="10" y="21.5" width="16" height="5" rx="2" fill="#fff" />
    </svg>
  );
}

export default function OGImage() {
  return (
    <div
      style={{
        width:           1200,
        height:          630,
        background:      COLORS.bg,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        position:        'relative',
        overflow:        'hidden',
        fontFamily:      '"DM Sans", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Decorative oval — sage-50 */}
      <div
        style={{
          position:     'absolute',
          width:        760,
          height:       520,
          borderRadius: '50%',
          background:   COLORS.sage50,
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
        }}
      />

      {/* Dot-grid texture */}
      <svg
        style={{ position: 'absolute', inset: 0, opacity: 0.4 }}
        width="1200"
        height="630"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill={COLORS.sage200} opacity="0.5" />
          </pattern>
        </defs>
        <rect width="1200" height="630" fill="url(#dots)" />
      </svg>

      {/* Content column */}
      <div
        style={{
          position:       'relative',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            0,
          zIndex:         1,
        }}
      >
        {/* Logo mark */}
        <Mark size={96} />

        {/* Wordmark */}
        <div
          style={{
            marginTop:   20,
            fontSize:    52,
            fontWeight:  600,
            letterSpacing: '-0.5px',
            lineHeight:  1,
            whiteSpace:  'nowrap',
          }}
        >
          <span style={{ color: COLORS.inkPrimary }}>Scatter</span>
          <span style={{ color: COLORS.sage500    }}>Pilot</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop:     14,
            fontSize:      22,
            fontWeight:    400,
            color:         COLORS.inkSecond,
            letterSpacing: '0.1px',
          }}
        >
          AI-Powered Invoicing for Consultants &amp; Agencies
        </div>

        {/* Separator */}
        <div
          style={{
            marginTop:   22,
            width:       120,
            height:      2,
            borderRadius: 2,
            background:  COLORS.border,
          }}
        />

        {/* Domain */}
        <div
          style={{
            marginTop:     16,
            fontSize:      17,
            fontWeight:    500,
            color:         COLORS.sage500,
            letterSpacing: '0.3px',
          }}
        >
          scatterpilot.com
        </div>
      </div>
    </div>
  );
}
