/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        // Wide extended display face for headlines only; always uppercase (see .font-display in index.css).
        display: ['Syncopate', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary — neutral aerospace grayscale
        primary: {
          50: '#f7f7f7',
          100: '#e7e7e7',
          200: '#c7c7c7',
          300: '#a1a1a1',
          400: '#7d7d7d',
          500: '#626262',
          600: '#4a4a4a',
          700: '#373737',
          800: '#292929',
          900: '#1c1c1c',
          950: '#101010',
        },
        // Secondary — neutral steel
        secondary: {
          50: '#f5f5f5',
          100: '#e2e2e2',
          200: '#c4c4c4',
          300: '#a5a5a5',
          400: '#858585',
          500: '#686868',
          600: '#505050',
          700: '#3c3c3c',
          800: '#2c2c2c',
          900: '#202020',
          950: '#141414',
        },
        // Accent: KARHUTLA palette (asap, bara, langit oranye). Reserve for primary actions.
        accent: {
          50: '#fcf5ec',
          100: '#f8e6cd',
          200: '#f1cb98',
          300: '#ecb067',
          400: '#e69430', // KARHUTLA #E69430
          500: '#d9831c', // KARHUTLA #D9831C
          600: '#c67438', // KARHUTLA #C67438
          700: '#9e4324', // KARHUTLA #9E4324
          800: '#7c3724',
          900: '#612c25', // KARHUTLA #612C25
          950: '#3a1a16',
        },
        // Named KARHUTLA swatches for gradients and illustration.
        karhutla: {
          asap: '#e69430',
          bara: '#d9831c',
          ember: '#c67438',
          rust: '#9e4324',
          char: '#612c25',
          paper: '#ecebe8',
          ink: '#171717',
          smoke: '#1a1210', // warm near-black where landing gradients bottom out
        },
        // Success — green
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Warning — yellow
        warning: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        // Error — red
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Fire intensity scale for heatmap
        flame: {
          0: '#1a1d27',
          1: '#3a1a0a',
          2: '#5e2107',
          3: '#8a2e08',
          4: '#b13a06',
          5: '#d4520a',
          6: '#f9880f',
          7: '#ffab2e',
          8: '#ffc75d',
          9: '#ffe09a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'ticker': 'ticker var(--ticker-duration, 60s) linear infinite',
        'panel-in': 'panelIn 0.35s cubic-bezier(0.2, 0.7, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        panelIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)', filter: 'blur(3px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 30px -10px rgba(0,0,0,0.25), 0 2px 6px -2px rgba(0,0,0,0.08)',
        'glow-accent': '0 0 20px rgba(217,131,28,0.3)',
        'glow-error': '0 0 20px rgba(239,68,68,0.3)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
};
