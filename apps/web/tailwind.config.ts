import type { Config } from "tailwindcss";
import sharedConfig from "@gts/config/tailwind";

const config: Config = {
  presets: [sharedConfig as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./emails/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#010101",
          cream: "#F2F0EA",
          yellow: "#EDCF5D",
          grey: "#A4A4A4",
        },
      },
      fontFamily: {
        // Athelas was loaded from a third-party host with no clear licence; Playfair Display (bundled) stands in.
        athelas: ["var(--font-serif)", "Georgia", "serif"],
        moara: ["Moara", "Bricolage Grotesque", "Impact", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-satoshi)", "var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-satoshi)", "Bricolage Grotesque", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
