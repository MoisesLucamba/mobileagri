/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1F6B3A',
          secondary: '#79C267',
          ink: '#173D24',
          forest: '#0A2814',
          muted: '#627264',
          chip: '#34503B',
        },
      },
    },
  },
  plugins: [],
};