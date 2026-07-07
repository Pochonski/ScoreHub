/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./admin/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#020617',
          800: '#0F172A',
          700: '#1E293B',
          600: '#334155',
        },
        accent: '#22C55E',
      },
      fontFamily: {
        sans: ['Fira Sans', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: []
}
