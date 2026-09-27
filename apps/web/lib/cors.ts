/**
 * Which browser origins the API answers with CORS headers, so the dashboard
 * and storefront can call it from wherever they are actually deployed.
 *
 * Local dev ports and the real *.gts.ng domains are always allowed. On top of
 * that, the exact origins configured in NEXT_PUBLIC_STOREFRONT_URL and
 * NEXT_PUBLIC_DASHBOARD_URL are allowed too — this is what makes a Vercel
 * preview/production deployment (e.g. gts-08-dashboard.vercel.app) work
 * without opening the door to every other vercel.app site, which an exact
 * match (rather than a *.vercel.app pattern) rules out.
 */

const STATIC_ALLOWED_ORIGIN_PATTERNS = [/^http:\/\/localhost:(3000|3001)$/, /^https:\/\/(.*\.)?gts\.ng$/, /^https:\/\/dashboard\.gts\.ng$/];

/** The origin (scheme + host + port) of a configured app URL, or null if it isn't a valid URL. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export interface CorsEnv {
  NEXT_PUBLIC_STOREFRONT_URL?: string;
  NEXT_PUBLIC_DASHBOARD_URL?: string;
}

export function isOriginAllowed(origin: string | null, env: CorsEnv): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) return true;

  const configured = [originOf(env.NEXT_PUBLIC_STOREFRONT_URL), originOf(env.NEXT_PUBLIC_DASHBOARD_URL)];
  return configured.includes(origin);
}
