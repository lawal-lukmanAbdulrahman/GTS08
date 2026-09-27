/**
 * Demo / live data isolation for the server (service-role) client.
 *
 * Rows on the tables below carry an `is_test` flag (migrations 00024 and 00025).
 * Which set a request sees depends on who is signed in: an account marked
 * users.is_demo sees the demo data, and everyone else, including anonymous
 * storefront visitors, sees the live shop.
 *
 * The service key bypasses row-level security, so the server scopes its own
 * queries here, in one place: every query on these tables gets
 * `is_test=eq.<mode>` added, and every insert or upsert is stamped with the
 * caller's mode (overriding anything the caller set, so a demo request can
 * never write live rows).
 *
 * The mode is read from the request's own credentials. Decoding the token
 * without verifying it here is deliberate: it only chooses which data set a
 * request looks at. Every protected route still verifies the same token, so a
 * forged one gets nothing but a view of public demo data.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type DataMode = "test" | "live";

/** Business records, split by migration 00024. */
export const BUSINESS_TABLES: readonly string[] = [
  "orders",
  "order_items",
  "transactions",
  "checkout_reservations",
  "promo_code_uses",
  "customers",
  "addresses",
  "support_tickets",
  "ticket_messages",
  "admin_notifications",
  "email_campaigns",
  "activity_logs",
  "stock_movements",
  // Shopper activity: demo browsing must not steer live recommendations.
  "product_views",
  "search_queries",
];

/** The catalogue and storefront content, split by migration 00025. */
export const CATALOGUE_TABLES: readonly string[] = [
  "products",
  "product_variants",
  "product_images",
  "inventory",
  "categories",
  "brands",
  "promos",
  "product_flags",
  "content_slots",
  "size_guides",
  "reviews",
  "product_drafts",
  "hero_carousel",
];

export const SCOPED_TABLES: readonly string[] = [...BUSINESS_TABLES, ...CATALOGUE_TABLES];

/** What to scope for one request: the caller's mode, and the tables the database has split so far. */
export interface Scope {
  mode: DataMode;
  tables: readonly string[];
}

const REST_PREFIX = "/rest/v1/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stampRows(body: string, isTest: boolean): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const stamp = (row: unknown) => (row && typeof row === "object" && !Array.isArray(row) ? { ...(row as object), is_test: isTest } : row);
  if (Array.isArray(parsed)) return JSON.stringify(parsed.map(stamp));
  if (parsed && typeof parsed === "object") return JSON.stringify(stamp(parsed));
  return null;
}

/** Wraps fetch so queries on scoped tables only reach, and only write, the rows of the caller's mode. */
export function createScopedFetch(baseFetch: typeof fetch, getScope: () => Promise<Scope | null>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return baseFetch(input, init);
    }
    if (!url.pathname.startsWith(REST_PREFIX)) return baseFetch(input, init);
    const table = url.pathname.slice(REST_PREFIX.length).split("/")[0] ?? "";
    if (!SCOPED_TABLES.includes(table)) return baseFetch(input, init);

    const scope = await getScope();
    if (!scope || !scope.tables.includes(table)) return baseFetch(input, init);
    const isTest = scope.mode === "test";
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (method === "POST") {
      const stamped = typeof init?.body === "string" ? stampRows(init.body, isTest) : null;
      if (stamped === null) return baseFetch(input, init);
      const columns = url.searchParams.get("columns");
      if (columns && !columns.split(",").includes('"is_test"')) url.searchParams.set("columns", `${columns},"is_test"`);
      return baseFetch(url.toString(), { ...init, body: stamped });
    }

    if (url.searchParams.has("is_test")) return baseFetch(input, init);
    url.searchParams.append("is_test", `eq.${isTest}`);
    return baseFetch(input instanceof Request ? new Request(url, input) : url.toString(), init);
  }) as typeof fetch;
}

/** The user id in a Supabase access token, or null. Not a verification (see the file comment). */
export function subjectFromJwt(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const sub = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown }).sub;
    return typeof sub === "string" && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** The caller's access token: a bearer header (dashboard) or the Supabase session cookie (storefront). */
export function accessTokenFromRequest(authorization: string | null, cookies: Array<{ name: string; value: string }>): string | null {
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;

  // @supabase/ssr stores the session as sb-<ref>-auth-token, split into .0, .1... when it is long.
  const parts = cookies
    .map((c) => ({ c, m: c.name.match(/^sb-[a-z0-9]+-auth-token(?:\.(\d+))?$/i) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1] ?? 0) - Number(b.m![1] ?? 0))
    .map((x) => x.c.value);
  if (parts.length === 0) return null;
  let value = parts.join("");
  try {
    value = value.startsWith("base64-") ? Buffer.from(value.slice(7), "base64url").toString("utf8") : decodeURIComponent(value);
    const session = JSON.parse(value) as { access_token?: unknown } | [unknown];
    const token = Array.isArray(session) ? session[0] : session.access_token;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

/** A small time-limited cache in front of an async lookup. Failures are never cached. */
export function createCachedLookup<V>(load: (key: string) => Promise<V>, opts: { ttlMs: number; now?: () => number; max?: number }) {
  const now = opts.now ?? Date.now;
  const max = opts.max ?? 1000;
  const cache = new Map<string, { value: V; at: number }>();
  const lookup = async (key: string): Promise<V> => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < opts.ttlMs) return hit.value;
    const value = await load(key);
    if (cache.size >= max) cache.delete(cache.keys().next().value as string);
    cache.set(key, { value, at: now() });
    return value;
  };
  lookup.size = () => cache.size;
  return lookup;
}

// Work that runs after the response has gone (emails) is pinned to the request's mode.
const modeOverride = new AsyncLocalStorage<DataMode>();

export function runWithDataMode<T>(mode: DataMode, fn: () => T): T {
  return modeOverride.run(mode, fn);
}

export function currentDataModeOverride(): DataMode | undefined {
  return modeOverride.getStore();
}

async function restGet(path: string): Promise<Response | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return fetch(`${base}${REST_PREFIX}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000), cache: "no-store" });
}

/** Whether an account is a demo account (cached a minute; demo status rarely changes). */
const isDemoUser = createCachedLookup(
  async (userId: string) => {
    const res = await restGet(`users?select=is_demo&id=eq.${userId}`);
    if (!res) return false;
    if (!res.ok) throw new Error(`users lookup failed (${res.status})`);
    const rows = (await res.json()) as Array<{ is_demo?: boolean }>;
    return rows[0]?.is_demo === true;
  },
  { ttlMs: 60_000 }
);

/** Which tables the database has split: none before 00024, the business tables after it, everything after 00025. */
const scopedTablesReady = createCachedLookup(
  async (_key: string): Promise<readonly string[]> => {
    const catalogue = await restGet("products?select=is_test&limit=1");
    if (catalogue?.ok) return SCOPED_TABLES;
    const business = await restGet("orders?select=is_test&limit=1");
    return business?.ok ? BUSINESS_TABLES : [];
  },
  { ttlMs: 60_000 }
);

/** The signed-in caller of the current request, from its bearer token or session cookie. */
async function requestUserId(): Promise<string | null> {
  try {
    // next/headers comes from the app that runs this package (as in server.ts).
    // @ts-ignore -- resolved by the Next.js app, not a dependency of this package
    const { headers, cookies } = await import("next/headers");
    const [h, c] = await Promise.all([headers(), cookies()]);
    const token = accessTokenFromRequest(h.get("authorization"), c.getAll());
    return token ? subjectFromJwt(token) : null;
  } catch {
    return null; // outside a request (scheduled jobs, scripts): the live shop
  }
}

/** The data mode of the current request: demo for a demo account, live for everyone else. */
export async function getRequestDataMode(): Promise<DataMode> {
  const pinned = currentDataModeOverride();
  if (pinned) return pinned;
  const userId = await requestUserId();
  if (!userId) return "live";
  try {
    return (await isDemoUser(userId)) ? "test" : "live";
  } catch {
    return "live";
  }
}

async function requestScope(): Promise<Scope | null> {
  let tables: readonly string[];
  try {
    tables = await scopedTablesReady("tables");
  } catch {
    return null;
  }
  if (tables.length === 0) return null;
  return { mode: await getRequestDataMode(), tables };
}

/** The fetch the server client uses. */
export const scopedServerFetch: typeof fetch = createScopedFetch((...args) => fetch(...args), requestScope);
