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
        sage: {
          DEFAULT: '#A3B087',     // Primary sage (CTAs)
          dark: '#778873',        // Darker sage (hover)
          light: 'rgba(163, 176, 135, 0.15)', // Light sage background
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
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #9333EA 0%, #DB2777 100%)', // Original purple/pink for landing page
        'gradient-brand-hover': 'linear-gradient(135deg, #7E22CE 0%, #BE185D 100%)', // Original hover
        'gradient-sage': 'linear-gradient(135deg, #A3B087 0%, #778873 100%)', // Sage for app
        'gradient-app': 'linear-gradient(135deg, #A3B087 0%, #9B7EBD 100%)', // Sage to purple for app CTAs
        'gradient-app-hover': 'linear-gradient(135deg, #778873 0%, #9B7EBD 100%)', // App CTA hover
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
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
