/**
 * Where the GTS API lives. Set NEXT_PUBLIC_API_URL (origin only, no path) when
 * it isn't on localhost:3000: another project may hold that port in dev, and
 * production points at the real host.
 */
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");
export const API_BASE = `${API_ORIGIN}/api/v1`;
