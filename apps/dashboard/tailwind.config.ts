import type { Config } from "tailwindcss";
import sharedConfig from "@gts/config/tailwind";

const config: Config = {
  presets: [sharedConfig as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#010101",
          gold: "#EDCF5D",
          cream: "#F2F0EA",
          grey: "#A4A4A4",
        },
        dash: {
          bg: "#1C1C1C", // Main workspace background
          sidebar: "#151515", // Sidebar background
          surface: "#1C1C1C", // Foreground surface (cards, active pills, search bar)
          surfaceHover: "#242424", // Hover surface
          border: "#262626", // Subtle borders
          textPrimary: "#FFFFFF",
          textSecondary: "#9CA3AF",
          textDim: "#6B7280",
          accent: "#EDCF5D",
        },
      },
      fontFamily: {
        sans: ["Satoshi", "var(--font-body)", "system-ui", "sans-serif"],
        display: ["Satoshi", "Bricolage Grotesque", "sans-serif"],
        serif: ["Athelas", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
