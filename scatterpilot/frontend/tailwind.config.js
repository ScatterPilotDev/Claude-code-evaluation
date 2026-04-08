export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ScatterPilot Brand Colors (maintained from landing page)
        brand: {
          primary: '#9333EA',    // purple-600
          secondary: '#DB2777',  // pink-600
          light: '#FAF5FF',      // purple-50
        },
        // Dark theme slate palette (Claude.ai-inspired)
        'slate-750': '#253345', // Custom between 700 and 800
        // Light Mode Color Palette - Landing Page (RESTORE ORIGINAL STRUCTURE)
        light: {
          bg: {
            primary: '#F5F5F0',    // Soft cream (main background)
            secondary: '#FFFFFF',   // White (cards, sections)
            tertiary: '#D2DCBB',    // Light sage-cream (subtle accents)
          },
          text: {
            primary: '#313647',     // Dark navy (headings)
            secondary: '#435663',   // Slate grey (body text)
            muted: '#778873',       // Muted sage (labels, captions)
          },
          accent: {
            sage: '#A3B087',        // Muted sage (primary CTAs, icons)
            'sage-dark': '#778873', // Darker sage (hover states)
            purple: '#9B7EBD',      // Purple accent
            cream: '#F5F5F0',       // Light cream (backgrounds)
          },
          border: {
            light: 'rgba(119, 136, 115, 0.15)',   // Subtle borders
            medium: 'rgba(119, 136, 115, 0.3)',   // Accent borders
          },
        },
        // App-specific colors (for post-login pages)
        cream: {
          DEFAULT: '#F5F5F0',     // Main background (soft cream)
          light: '#FAFAF8',       // Subtle alternate sections
        },
        navy: {
          DEFAULT: '#313647',     // Dark navy (headings)
          light: '#435663',       // Slate grey (body text)
          muted: '#778873',       // Muted sage (labels)
        },
        purple: {
          DEFAULT: '#9B7EBD',     // Secondary accent
          light: '#D4BEE4',       // Light purple background
        },
        // Enterprise Color Palette (kept for backward compatibility)
        enterprise: {
          navy: {
            DEFAULT: '#313647',  // Deep navy-charcoal (main background)
            dark: '#2A2F3F',     // Darker navy (footer)
          },
          slate: '#435663',      // Slate blue-grey (sections)
          sage: {
            DEFAULT: '#A3B087',  // Muted sage green (CTAs, accents)
            hover: '#8b9972',    // Darker sage for hover
          },
          cream: {
            DEFAULT: '#FFF8D4',  // Soft cream (highlights)
            hover: '#FFFADC',    // Lighter cream for hover
          },
          text: {
            primary: '#FFFFFF',  // White (headings)
            secondary: '#E0E0E0',// Light grey (body)
            muted: '#A0A0A0',    // Muted grey (labels)
          },
        },
        // ── Design System v2 ──────────────────────────────────────────────
        // Primary — Dark Sage
        sage: {
          50: '#F4F7F3',
          100: '#E6ECE4',
          200: '#CEDCC9',
          300: '#AECA9F',
          400: '#7FAF6F',
          500: '#4A6741',   // PRIMARY — use for buttons, active nav, links
          600: '#3D5636',
          700: '#30442B',
          800: '#243320',
          900: '#1A2318',   // Text primary
          950: '#0D1209',
        },
        // Accent — Warm Amber
        amber: {
          50: '#FFF9EB',
          100: '#FFF0CC',
          200: '#FFE099',
          300: '#FFCC55',
          400: '#DAA520',
          500: '#B8860B',   // ACCENT — warnings, highlights, secondary CTAs
          600: '#946B09',
          700: '#705007',
          800: '#4C3605',
          900: '#2E2003',
        },
        // Semantic
        success: {
          50: '#EDFAF2',
          100: '#D1F3DE',
          200: '#A3E7BD',
          300: '#5DD48D',
          400: '#2D7A4F',   // SUCCESS
          500: '#1D5E3A',
        },
        danger: {
          50: '#FEF2F0',
          100: '#FDE1DC',
          200: '#FBC0B6',
          300: '#F48E7D',
          400: '#C2412D',   // DANGER
          500: '#9C3424',
        },
        // Neutrals — sage-tinted
        surface: {
          bg: '#FAFBF9',
          card: '#FFFFFF',
          border: '#E2E5DE',
          'border-strong': '#C8CEC3',
          hover: '#F0F2ED',
          muted: '#F5F7F3',
        },
        // Text
        ink: {
          primary: '#1A2318',
          secondary: '#5F6B5A',
          tertiary: '#8A9484',
          inverse: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          '"Fira Sans"',
          '"Droid Sans"',
          '"Helvetica Neue"',
          'sans-serif'
        ],
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading-lg': ['1.75rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '600' }],
        'heading': ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-sm': ['1.0625rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.04em', fontWeight: '500' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      borderRadius: {
        'card': '10px',
        'input': '8px',
        'badge': '6px',
        'button': '8px',
        'pill': '9999px',
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(147, 51, 234, 0.3)',
        'glow-purple-lg': '0 0 40px rgba(147, 51, 234, 0.4)',
        'enterprise-sm': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'enterprise-md': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'enterprise-lg': '0 8px 24px rgba(0, 0, 0, 0.2)',
        'enterprise-sage': '0 8px 24px rgba(163, 176, 135, 0.2)',
        'enterprise-video': '0 20px 60px rgba(0, 0, 0, 0.3)',
        // Light mode shadows
        'light-sm': '0 4px 16px rgba(49, 54, 71, 0.06)',
        'light-md': '0 8px 32px rgba(49, 54, 71, 0.12)',
        'light-lg': '0 24px 64px rgba(49, 54, 71, 0.15)',
        'light-xl': '0 4px 24px rgba(49, 54, 71, 0.08)',
        'light-sage': '0 4px 16px rgba(163, 176, 135, 0.3)',
        // Design System v2
        'card': '0 1px 3px rgba(26, 35, 24, 0.04), 0 1px 2px rgba(26, 35, 24, 0.02)',
        'card-hover': '0 4px 12px rgba(26, 35, 24, 0.06), 0 1px 3px rgba(26, 35, 24, 0.04)',
        'dropdown': '0 8px 24px rgba(26, 35, 24, 0.08), 0 2px 6px rgba(26, 35, 24, 0.04)',
        'modal': '0 16px 48px rgba(26, 35, 24, 0.12), 0 4px 12px rgba(26, 35, 24, 0.06)',
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #9333EA 0%, #DB2777 100%)', // Original purple/pink for landing page
        'gradient-brand-hover': 'linear-gradient(135deg, #7E22CE 0%, #BE185D 100%)', // Original hover
        'gradient-sage': 'linear-gradient(135deg, #A3B087 0%, #778873 100%)', // Sage for app
        'gradient-app': 'linear-gradient(135deg, #A3B087 0%, #9B7EBD 100%)', // Sage to purple for app CTAs
        'gradient-app-hover': 'linear-gradient(135deg, #778873 0%, #9B7EBD 100%)', // App CTA hover
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'scale-in':   'scaleIn 0.2s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
    },
  },
  plugins: [],
}
