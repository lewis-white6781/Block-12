/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        calibration: 'var(--calibration)',
        accumulation: 'var(--accumulation)',
        deload: 'var(--deload)',
        intensification: 'var(--intensification)',
        peak: 'var(--peak)',
        taper: 'var(--taper)',
        test: 'var(--test)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        good: 'var(--good)',
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '10px',
      },
    },
  },
  plugins: [],
}
