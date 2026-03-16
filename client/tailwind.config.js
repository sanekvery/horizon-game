/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'horizon': {
          'dark': '#0D1B2A',
          'navy': '#1B263B',
          'slate': '#415A77',
          'steel': '#778DA9',
          'light': '#E0E1DD',
        },
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
