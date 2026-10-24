/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#C9A84C',
          600: '#a78838',
          700: '#854d0e',
          800: '#713f12',
          900: '#422006',
        },
        navy: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          700: '#1A1A2E',
          800: '#13132a',
          900: '#0d0d1a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
