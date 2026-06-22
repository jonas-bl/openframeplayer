/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral dark surface palette for the player chrome.
        surface: {
          900: '#0a0a0b',
          800: '#141417',
          700: '#1d1d22',
          600: '#28282f',
          500: '#3a3a44'
        },
        accent: {
          DEFAULT: '#5b8cff',
          hover: '#7aa2ff',
          muted: '#3b5bbf'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
