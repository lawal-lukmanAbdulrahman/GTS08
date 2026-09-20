import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests for the four flows the business depends on.
 *
 *   pnpm --filter @gts/dashboard test:e2e
 *
 * Needs the API (default :3002) and dashboard (default :3001) running against a
 * NON-PRODUCTION Supabase project, and the service key in the root .env. Test
 * accounts are created and deleted by the tests themselves (see e2e/support).
 */
const DASHBOARD = process.env.E2E_DASHBOARD_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // one shared database and one rate limiter: run flows one at a time
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: DASHBOARD,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
});
