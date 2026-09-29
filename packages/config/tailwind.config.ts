import type { Config } from "tailwindcss";

const config: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#2E9E5B",
          hover: "#23824A",
          soft: "#DCEFE3",
        },
        ink: {
          DEFAULT: "#20261F",
          2: "#2A312A",
        },
        mint: "#EAF5EE",
        page: "#F6F8F6",
        card: "#FFFFFF",
        txt: {
          DEFAULT: "#1A211B",
          2: "#5C6A5E",
          3: "#8A968C",
        },
        line: "#E3E9E4",
        amber: {
          DEFAULT: "#E8A23D",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        orange: {
          DEFAULT: "#E2622B",
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        red: {
          DEFAULT: "#D75A4A",
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "Bricolage Grotesque",
          "system-ui",
          "sans-serif",
        ],
        body: ["var(--font-body)", "DM Sans", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "IBM Plex Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "22px",
        md: "14px",
        sm: "9px",
      },
      boxShadow: {
        gts: "0 18px 50px -18px rgba(32,38,31,.22)",
        "gts-sm": "0 6px 20px -8px rgba(32,38,31,.14)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
      },
    },
  },
};

export default config;
