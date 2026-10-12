/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#218B4A',
          secondary: '#EAF5ED',
          ink: '#173D24',
          forest: '#0A2814',
          muted: '#6D7B71',
          chip: '#218B4A',
        },
        canvas: '#F3F6F2',
        surface: '#FFFEFC',
      },
    },
  },
  plugins: [],
};