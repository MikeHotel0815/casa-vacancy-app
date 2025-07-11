/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Hier wird sichergestellt, dass alle React-Komponenten gescannt werden
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Stellt sicher, dass 'font-sans' die Inter-Schriftart verwendet
      },
    },
  },
  plugins: [],
}
