/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#06070B",
          secondary: "#0E1017",
          card: "#161924",
          border: "#252B3B",
          purple: "#A855F7",
          purpleHover: "#9333EA",
          cyan: "#06B6D4",
          text: "#F8FAFC",
          muted: "#94A3B8",
          red: "#EF4444",
          amber: "#F59E0B",
          emerald: "#10B981",
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'neon-purple': '0 0 20px -3px rgba(168, 85, 247, 0.4)',
        'neon-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.4)',
        'neon-red': '0 0 20px -3px rgba(239, 68, 68, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite alternate',
        'matrix-scan': 'matrixScan 3s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%': { boxShadow: '0 0 10px rgba(168, 85, 247, 0.2)' },
          '100%': { boxShadow: '0 0 25px rgba(168, 85, 247, 0.6)' },
        },
        matrixScan: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        }
      }
    },
  },
  plugins: [],
}
