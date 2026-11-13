/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      colors: {
        'bg-page': '#F7F3EC',
        surface: '#FFFEFC',
        'text-main': '#20281F',
        'text-muted': '#625F54',
        accent: {
          DEFAULT: '#28523B',
          soft: '#EDF2E9',
        },
        'border-main': '#D8D0C2',
        route: '#A94D2C',
        'state-success': '#28523B',
        'state-warning': '#805315',
        'state-error': '#A33229',
        'state-focus': '#315D76',
      },
      borderRadius: {
        btn: '10px',
        card: '16px',
        sheet: '24px',
      },
    },
  },
  plugins: [],
};
