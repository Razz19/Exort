/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{svelte,ts}'],
  theme: {
    extend: {
      colors: {
        dark: {
          surface: '#302d2b',
          border: '#504945',
          bg: "#282828",
          bg0: "#282828",
          bgH: "#1d2021",
          bgS: "#32302f",
          bg1: "#3c3836",
          bg2: "#504945",
          bg3: "#665c54",
          bg4: "#7c6f64",

          fg: "#ebdbb2",
          fg0: "#fbf1c7",
          fg1: "#ebdbb2",
          fg2: "#d5c4a1",
          fg3: "#bdae93",
          fg4: "#a89984",

          red: "#cc241d",
          red2: "#fb4934",
          green: "#98971a",
          green2: "#b8bb26",
          yellow: "#d79921",
          yellow2: "#fabd2f",
          blue: "#458588",
          blue2: "#83a598",
          purple: "#b16286",
          purple2: "#d3869b",
          aqua: "#689d6a",
          aqua2: "#8ec07c",
          orange: "#d65d0e",
          orange2: "#fe8019",
          gray: "#a89984",
          gray2: "#928374"
        },
        primary: {
          300: '#83a598',
          500: '#458588',
          600: '#458588',
          700: '#076678'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      }
    }
  },
  plugins: []
};
