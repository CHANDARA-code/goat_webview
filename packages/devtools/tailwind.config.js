/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ide: {
          bg: {
            dark: '#1e1e1e',
            light: '#ffffff',
          },
          panel: {
            dark: '#252526',
            light: '#f3f3f3',
          },
          sidebar: {
            dark: '#333333',
            light: '#2c2c2c',
          },
          border: {
            dark: '#3c3c3c',
            light: '#e5e5e5',
          },
          accent: {
            DEFAULT: '#007acc',
            hover: '#0062a3',
          },
        },
      },
    },
  },
  plugins: [],
}
