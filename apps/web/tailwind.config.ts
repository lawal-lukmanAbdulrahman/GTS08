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
        athelas: ["Athelas", "Georgia", "serif"],
        moara: ["Moara", "Bricolage Grotesque", "Impact", "sans-serif"],
        serif: ["Athelas", "Georgia", "serif"],
        sans: ["Satoshi", "var(--font-body)", "system-ui", "sans-serif"],
        display: ["Satoshi", "Bricolage Grotesque", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
