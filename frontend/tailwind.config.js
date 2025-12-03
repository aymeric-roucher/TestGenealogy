/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', '"Times New Roman"', 'serif'],
        body: ['"Cormorant Garamond"', '"Garamond"', 'serif'],
      },
      colors: {
        parchment: '#f8f6f1',
        ink: '#0f0f0f',
        soot: '#1f1f1f',
      },
      boxShadow: {
        card: '0 12px 28px rgba(0,0,0,0.14)',
      },
    },
  },
  plugins: [],
};
