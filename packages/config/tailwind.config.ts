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
        amber: "#E8A23D",
        orange: "#E2622B",
        red: "#D75A4A",
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
