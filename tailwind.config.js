/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        admin: {
          bg:      '#0f172a',
          sidebar: '#1e293b',
          card:    '#1e293b',
          border:  '#334155',
          text:    '#f1f5f9',
          muted:   '#94a3b8',
        },
        /* ── "Get Started" chooser page (Part 1) ─────────────────────────
           Two deliberately distinct accents for the hire/earn fork: the
           existing brand blue for "hire," and a new ochre/amber — never
           used elsewhere — for "earn," so the two paths read as genuinely
           different journeys, not just two cards in the same color. */
        hire: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          600: '#2454EB',
          700: '#1A3FC4',
        },
        earn: {
          50:  '#FFF6EA',
          100: '#FDECD2',
          600: '#C2660A',
          700: '#9C5208',
        },
        paper: '#F6F4EF',
        ink:   '#0E1320',
        seam:  '#E4E0D6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-brand': '0 0 20px -5px rgba(59,130,246,0.4)',
        'glow-success': '0 0 20px -5px rgba(16,185,129,0.4)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4)',
        'modal': '0 25px 50px -12px rgba(0,0,0,0.7)',
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-in-out',
        'fade-in-up':    'fadeInUp 0.3s ease-out',
        'slide-in':      'slideIn 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-slow':    'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':     'spin 2s linear infinite',
        'shimmer':       'shimmer 1.5s infinite',
        'bounce-in':     'bounceIn 0.4s cubic-bezier(0.36,0.07,0.19,0.97)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        slideInLeft: {
          '0%':   { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0'  },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '60%':  { transform: 'scale(1.02)', opacity: '1' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
      backgroundImage: {
        'shimmer-gradient':
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color:          theme('colors.gray.700'),
            maxWidth:       'none',
            lineHeight:     '1.8',
            'h1,h2,h3,h4': { color: theme('colors.gray.900'), fontWeight: '700' },
            a: {
              color:           theme('colors.blue.600'),
              textDecoration:  'none',
              '&:hover':       { textDecoration: 'underline' },
            },
            blockquote: {
              borderLeftColor: theme('colors.blue.400'),
              backgroundColor: theme('colors.blue.50'),
              borderRadius:    '0 0.5rem 0.5rem 0',
              padding:         '1rem 1.25rem',
              fontStyle:       'normal',
              color:           theme('colors.gray.700'),
            },
            code: {
              backgroundColor: theme('colors.gray.100'),
              borderRadius:    '0.25rem',
              padding:         '0.125rem 0.375rem',
              color:           theme('colors.gray.800'),
              fontWeight:      '400',
            },
            'code::before': { content: '""' },
            'code::after':  { content: '""' },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};