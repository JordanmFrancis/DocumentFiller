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
        hand: ['Patrick Hand', 'system-ui', 'sans-serif'],
        cursive: ['Caveat', 'cursive'],
        marker: ['Kalam', 'cursive'],
        typewriter: ['Special Elite', 'monospace'],
        monohand: ['JetBrains Mono', 'monospace'],
        serifhand: ['Source Serif 4', 'Georgia', 'serif'],
      },
      colors: {
        paper: {
          DEFAULT: '#efece4',
          legalpad: '#fdf6c7',
          manila: '#e7d7a8',
          indexcard: '#fbfbf4',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          soft: '#4a4a4a',
          faint: '#888',
        },
        accent: {
          yellow: '#ffde59',
          mint: '#6de0b6',
          coral: '#ff6b6b',
          'margin-red': '#d22828',
          'line-blue': '#2848a0',
        },
        // Legacy aliases preserved so existing API stays compatible
        background: 'var(--paper-bg)',
        foreground: 'var(--ink)',
        primary: {
          DEFAULT: '#1a1a1a',
          hover: '#000000',
        },
        secondary: {
          DEFAULT: '#ffde59',
          hover: '#ffd633',
        },
        border: '#1a1a1a',
        input: '#fff',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'ink-in': 'inkAppear 0.3s ease-out',
        'wobble': 'wobble 0.4s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        inkAppear: {
          '0%': { opacity: '0', transform: 'translateY(-3px) rotate(-1deg)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(-0.3deg)' },
          '50%': { transform: 'rotate(0.3deg)' },
        },
      },
      boxShadow: {
        'rough': '2px 2px 0 #1a1a1a',
        'rough-lg': '4px 4px 0 #1a1a1a',
        'rough-xl': '6px 6px 0 #1a1a1a',
      },
    },
  },
  plugins: [],
}
export default config
