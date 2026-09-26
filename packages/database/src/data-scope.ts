/**
 * Test / Live data isolation for the server (service-role) client.
 *
 * Business records carry an `is_test` flag (migration 00017) and settings.data_mode
 * says which side the shop is on. The service key bypasses row-level security, so
 * the app scopes its own reads and writes here, in one place: every query on a
 * business table gets `is_test=eq.<mode>` added before it leaves the server.
 * Inserts are not touched; the database stamps new rows with the current mode.
 */

export type DataMode = "test" | "live";

/** The tables whose rows are business data. Catalogue, staff, carts, wishlists and settings are shared. */
export const SCOPED_TABLES: readonly string[] = [
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
];

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const REST_PREFIX = "/rest/v1/";

interface ReaderOptions {
  read: () => Promise<DataMode | null>;
  ttlMs: number;
  now?: () => number;
}

export interface DataModeReader {
  get(): Promise<DataMode | null>;
  invalidate(): void;
}

/**
 * Caches the mode for a few seconds so one page load isn't a settings read per
 * query. A failed refresh keeps the last known mode: isolation must not switch
 * itself off because of a network blip.
 */
export function createDataModeReader({ read, ttlMs, now = Date.now }: ReaderOptions): DataModeReader {
  let mode: DataMode | null = null;
  let readAt = -Infinity;
  let inflight: Promise<DataMode | null> | null = null;

  const refresh = () => {
    if (!inflight) {
      inflight = read()
        .then((m) => {
          mode = m;
          readAt = now();
          return mode;
        })
        .catch(() => mode)
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };

  return {
    get: () => (now() - readAt < ttlMs ? Promise.resolve(mode) : refresh()),
    invalidate: () => {
      readAt = -Infinity;
    },
  };
}

/** Wraps fetch so queries on business tables only see the rows of the current mode. */
export function createScopedFetch(baseFetch: typeof fetch, getMode: () => Promise<DataMode | null>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    // Inserts and upserts are stamped by the database default; everything else is filtered.
    if (method === "POST") return baseFetch(input, init);

    const raw = input instanceof Request ? input.url : String(input);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return baseFetch(input, init);
    }
    if (!url.pathname.startsWith(REST_PREFIX)) return baseFetch(input, init);
    const table = url.pathname.slice(REST_PREFIX.length).split("/")[0] ?? "";
    if (!SCOPED_TABLES.includes(table) || url.searchParams.has("is_test")) return baseFetch(input, init);

    const mode = await getMode();
    if (!mode) return baseFetch(input, init);

    url.searchParams.append("is_test", `eq.${mode === "test"}`);
    return baseFetch(input instanceof Request ? new Request(url, input) : url.toString(), init);
  }) as typeof fetch;
}

const reader = createDataModeReader({
  ttlMs: 5000,
  read: async () => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !key) return null;
    const res = await fetch(`${base}${REST_PREFIX}settings?select=data_mode&id=eq.${SETTINGS_ID}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    // Before migration 00017 the column doesn't exist: no isolation yet, and nothing breaks.
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ data_mode?: string }>;
    const value = rows[0]?.data_mode;
    return value === "test" || value === "live" ? value : null;
  },
});

/** The fetch the server client uses. */
export const scopedServerFetch: typeof fetch = createScopedFetch((...args) => fetch(...args), () => reader.get());

/** The current mode (cached a few seconds). Null until migration 00017 is applied. */
export const getDataMode = () => reader.get();

/** Call after changing the mode so this server sees it immediately rather than after the cache window. */
export const invalidateDataMode = () => reader.invalidate();
