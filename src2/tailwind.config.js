module.exports = {
  content: [
    './**/*.{html,ts,tsx}',
    './popup/**/*.{html,ts,tsx}',
    './options/**/*.{html,ts,tsx}',
    './background/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './shared/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#EF4056',
          hover: '#D93A4E',
          light: '#FCE8EA',
          dark: '#C02D40',
        },
        secondary: {
          DEFAULT: '#333333',
          light: '#666666',
          lighter: '#EEEEEE',
          dark: '#222222',
        },
      },
      boxShadow: {
        'popup': '0 2px 10px rgba(0, 0, 0, 0.1)',
        'tag': '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'spin-fast': 'spin 0.5s linear infinite',
      }
    },
  },
  plugins: [],
}; 