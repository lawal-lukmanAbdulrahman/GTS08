/**
 * Where the dashboard sends API calls.
 *
 * The browser always calls the dashboard's own origin (`/api/v1/...`), and
 * next.config.ts rewrites `/api/*` to the real API. Calls are therefore
 * same-origin: CORS never applies, so a new deployment address (a Vercel
 * preview, a custom domain) can't break sign-in by missing from an allowlist.
 */
export const API_BASE = "/api/v1";

/**
 * The API's origin for the proxy, from NEXT_PUBLIC_API_URL (origin only; a
 * trailing slash or /api/v1 suffix is tolerated). Read by next.config.ts when
 * the dashboard is built, so it must be set before the build.
 */
export function apiProxyTarget(configured: string | undefined): string {
  return (configured || "http://localhost:3002")
    .replace(/\/+$/, "")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/api\/?$/, "");
}
