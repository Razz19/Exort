/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gruvbox: {
          bg: '#282828',
          nav: '#282828',
          surface: 'rgba(60, 56, 54, 0.78)',
          'surface-strong': 'rgba(80, 73, 69, 0.9)',
          text: '#ebdbb2',
          muted: 'rgba(213, 196, 161, 0.78)',
          accent: '#fe8019',
          'accent-soft': 'rgba(250, 189, 47, 0.82)',
          fg0: '#fbf1c7',
          fg1: '#ebdbb2',
          blue: '#458588',
          green: '#98971a',
          yellow: '#fabd2f',
          orange: '#fe8019',
          purple: '#d3869b',
          ink: '#333231',
          'ink-strong': 'rgba(29, 32, 33, 0.9)'
        }
      },
      fontFamily: {
        sans: [
          '"Baloo Bhai 2"',
          'SF Pro Display',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        heading: [
          'Michroma',
          'SF Pro Display',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      boxShadow: {
        soft: '0 18px 48px rgba(29, 32, 33, 0.24)',
        strong: '0 26px 90px rgba(29, 32, 33, 0.3)',
        'outline-subtle': '0 0 0 1px rgba(0, 0, 0, 0.18)',
        'card-sm': '0 12px 30px rgba(29, 32, 33, 0.16)',
        'card-md':
          '0 18px 50px rgba(0, 0, 0, 0.38), 0 8px 40px rgba(0, 0, 0, 0.32)',
        'card-lg': '0 16px 38px rgba(29, 32, 33, 0.18)',
        nav: '0 10px 24px rgba(29, 32, 33, 0.14)'
      },
      keyframes: {
        'hero-text-sweep-right': {
          '0%': {
            clipPath: 'inset(0 100% 0 0)',
            opacity: '0'
          },
          '4%': {
            clipPath: 'inset(0 78% 0 0)',
            opacity: '1'
          },
          '14%': {
            clipPath: 'inset(0 0 0 0)',
            opacity: '1'
          },
          '20%': {
            clipPath: 'inset(0 0 0 100%)',
            opacity: '1'
          },
          '25%, 100%': {
            clipPath: 'inset(0 0 0 100%)',
            opacity: '0'
          }
        },
        'hero-text-sweep-left': {
          '0%': {
            clipPath: 'inset(0 0 0 100%)',
            opacity: '0'
          },
          '4%': {
            clipPath: 'inset(0 0 0 78%)',
            opacity: '1'
          },
          '14%': {
            clipPath: 'inset(0 0 0 0)',
            opacity: '1'
          },
          '20%': {
            clipPath: 'inset(0 100% 0 0)',
            opacity: '1'
          },
          '25%, 100%': {
            clipPath: 'inset(0 100% 0 0)',
            opacity: '0'
          }
        }
      },
      animation: {
        'hero-text-sweep-right':
          'hero-text-sweep-right 6s linear infinite',
        'hero-text-sweep-left':
          'hero-text-sweep-left 6s linear infinite'
      }
    }
  },
  plugins: []
};
