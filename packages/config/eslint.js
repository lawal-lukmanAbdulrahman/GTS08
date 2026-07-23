import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

/** @param {{ next?: boolean }} options */
export function createConfig({ next = false } = {}) {
  return tseslint.config(
    ...tseslint.configs.recommended,
    {
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
    next
      ? {
          plugins: { "@next/next": nextPlugin },
          rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs["core-web-vitals"].rules,
          },
        }
      : {},
    {
      ignores: [
        "node_modules/**",
        ".next/**",
        "dist/**",
        "coverage/**",
        "*.config.js",
        "*.config.ts",
        "next-env.d.ts",
      ],
    }
  );
}
