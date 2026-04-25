import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: '#f3eee0',
          card: '#fbf8f0',
          elev: '#ffffff',
          edge: '#ede7d6',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          soft: '#5a554a',
          faint: '#8e887a',
          muted: '#b6af9b',
        },
        rule: {
          DEFAULT: '#e0d9c6',
          strong: '#c9c0a8',
          soft: '#ebe5d3',
        },
        accent: {
          DEFAULT: '#2d4a3a',
          soft: '#3d6149',
          tint: '#e9f0ea',
          line: '#b6c9b6',
        },
        warning: {
          DEFAULT: '#b86b2e',
          tint: '#f5e4d2',
        },
        danger: {
          DEFAULT: '#b03a3a',
          tint: '#f3dada',
        },
        // Legacy aliases preserved for any third-party props that read them
        background: 'var(--paper)',
        foreground: 'var(--ink)',
        primary: {
          DEFAULT: '#2d4a3a',
          hover: '#3d6149',
        },
        secondary: {
          DEFAULT: '#1a1a1a',
          hover: '#2c2c2c',
        },
        border: '#e0d9c6',
        input: '#ffffff',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'scale-in': 'scaleIn 0.18s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.97)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
