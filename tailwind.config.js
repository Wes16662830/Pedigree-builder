/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oudeluck: {
          gold: '#D19A45',
          black: '#111111',
        },
      },
    },
  },
  plugins: [],
};
