import type { Config } from "tailwindcss";
import sharedConfig from "@gts/config/tailwind";

const config: Config = {
  presets: [sharedConfig as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
