import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          raised: "#161b22",
          overlay: "#1c2128",
          border: "#30363d",
        },
        accent: {
          DEFAULT: "#3b82f6",
          muted: "#1d4ed8",
          glow: "rgba(59, 130, 246, 0.15)",
        },
        success: {
          DEFAULT: "#22c55e",
          muted: "#15803d",
          glow: "rgba(34, 197, 94, 0.15)",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "#b91c1c",
          glow: "rgba(239, 68, 68, 0.15)",
        },
        labels: {
          DEFAULT: "#a855f7",
          muted: "#7e22ce",
          glow: "rgba(168, 85, 247, 0.12)",
        },
        wholesale: {
          DEFAULT: "#3b82f6",
          muted: "#2563eb",
          glow: "rgba(59, 130, 246, 0.12)",
        },
        retail: {
          DEFAULT: "#eab308",
          muted: "#ca8a04",
          glow: "rgba(234, 179, 8, 0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
