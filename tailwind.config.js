/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Crow Companion: dusk amber, bone, moss and feather black (was Capri's CP red / neon)
        cp: {
          50: '#fbf3e4',
          100: '#f4e3c2',
          200: '#ead095',
          300: '#e2bc6f',
          400: '#dcae58',
          500: '#d9a14a',
          600: '#bd853a',
          700: '#8a6a3a',
          800: '#4a3923',
          900: '#241c13',
          950: '#15110c'
        },
        cyber: {
          dark: '#0d0e12',
          card: 'rgba(20, 19, 17, 0.88)',
          magenta: '#d9a14a',
          cyan: '#a5c27a',
          blue: '#e8dcc0',
          purple: '#8f86c9'
        },
        cyan: { 50: '#fbf7ee', 100: '#f5eddb', 200: '#eee0c3', 300: '#e8d6b0', 400: '#e2cb9c', 500: '#d6ba82', 600: '#b99a63', 700: '#8f764b', 800: '#5b4b31', 900: '#3a3020', 950: '#211b12' },
        pink: { 50: '#fbf3e4', 100: '#f4e3c2', 200: '#ead095', 300: '#e2bc6f', 400: '#dcae58', 500: '#d9a14a', 600: '#bd853a', 700: '#8a6a3a', 800: '#4a3923', 900: '#241c13', 950: '#15110c' },
        fuchsia: { 300: '#e2bc6f', 400: '#dcae58', 500: '#d9a14a', 600: '#bd853a' },
        purple: { 300: '#b9b2e0', 400: '#a29ad4', 500: '#8f86c9', 600: '#756cb0' },
        emerald: { 300: '#c4d8a4', 400: '#b2cc8c', 500: '#a5c27a', 600: '#869f5f', 700: '#62763f', 900: '#2a3320' },
        yellow: { 200: '#f1dea6', 300: '#ead08a', 400: '#e2c06a', 500: '#ddb23c', 600: '#b98f28' }
      }
    }
  },
  plugins: []
}
