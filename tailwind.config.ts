import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          deep: '#050D1D',
          DEFAULT: '#071226',
          panel: '#0a1628',
          lift: '#0c1a32',
        },
        accent: {
          DEFAULT: '#F23E26',
          dim: '#c93420',
        },
        muted: {
          DEFAULT: '#8b9bb4',
          dim: '#6a7a94',
        },
        ink: {
          DEFAULT: '#f4f6fa',
          soft: '#F23E26',
        },
        /* Legacy aliases mapped to new system */
        cream: {
          DEFAULT: '#071226',
          dark: '#050D1D',
        },
        surface: '#f4f6fa',
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'sans-serif'],
        display: ['var(--font-outfit)', 'sans-serif'],
      },
      letterSpacing: {
        display: '-0.03em',
        'display-tight': '-0.025em',
      },
      lineHeight: {
        display: '1.05',
        'display-snug': '1.1',
      },
      boxShadow: {
        glow: '0 0 40px rgba(242, 62, 38, 0.12)',
        'glow-sm': '0 0 24px rgba(242, 62, 38, 0.08)',
        panel: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
