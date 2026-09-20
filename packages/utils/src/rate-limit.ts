/**
 * Rate limiting decided by WHO is calling, not just their address.
 *
 * A shop's tills share one public address, so limiting by address alone makes
 * every cashier share a single small budget. Signed-in callers therefore get a
 * personal bucket, and every caller also sits under a larger per-address
 * ceiling so nobody can dodge limits by inventing identities.
 *
 * Counting goes through a store: shared Redis (Upstash, over its REST API)
 * when configured, otherwise in memory (fine for one server, not for many).
 */

export interface Bucket {
  key: string;
  limit: number;
  windowMs: number;
  tier: "user" | "ip" | "auth";
}

export interface Caller {
  ip: string;
  userId: string | null;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export interface ConsumeResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the tightest window resets. */
  resetTime: number;
  retryAfterSeconds: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The user id inside a bearer token, ONLY to pick a rate-limit bucket. The token
 * is not verified here (the route does that), which is why every caller also
 * has an address ceiling.
 */
export function userIdFromAuthHeader(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const parts = header.slice(7).trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" && UUID.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

const MINUTE = 60_000;
// Attempts to prove who you are. Session housekeeping (/auth/me, /auth/logout, passkey lists) is not one.
const CREDENTIAL_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/pin-login",
  "/api/v1/auth/register",
  "/api/v1/auth/pin/verify",
  "/api/v1/auth/pin/reset-with-password",
  "/api/v1/auth/phone/send-code",
  "/api/v1/auth/phone/verify-code",
  "/api/v1/auth/passkeys/auth-options",
  "/api/v1/auth/passkeys/auth-verify",
];

function isSaleWrite(method: string, pathname: string): boolean {
  if (method === "GET") return false;
  return pathname === "/api/v1/pos/orders" || pathname.startsWith("/api/v1/pos/whatsapp-orders");
}

export function planBuckets(method: string, pathname: string, caller: Caller): Bucket[] {
  const { ip, userId } = caller;

  if (CREDENTIAL_PATHS.includes(pathname)) {
    // Generous enough for a whole shop to sign in; targeted guessing is limited per account in the route.
    return [{ key: `rl:auth:${ip}`, limit: 20, windowMs: MINUTE, tier: "auth" }];
  }

  // Public endpoints an abuser would hammer. These apply to everyone, signed in or not.
  if (method === "POST" && pathname === "/api/v1/tickets") return [{ key: `rl:tickets:${ip}`, limit: 3, windowMs: 10 * MINUTE, tier: "ip" }];
  if (method === "POST" && pathname === "/api/v1/promos/validate") return [{ key: `rl:promo:${ip}`, limit: 20, windowMs: MINUTE, tier: "ip" }];
  if (method === "POST" && /^\/api\/v1\/cart\/[^/]+\/items$/.test(pathname)) return [{ key: `rl:cart:${ip}`, limit: 30, windowMs: MINUTE, tier: "ip" }];

  if (pathname === "/api/v1/checkout") {
    return [{ key: `rl:checkout:${ip}`, limit: 15, windowMs: MINUTE, tier: "ip" }];
  }

  if (!userId) {
    const mutation = method !== "GET";
    const content = /^\/api\/v1\/(inquiries|reviews|broadcast)/.test(pathname);
    return [{ key: `rl:ip:${ip}:${content && mutation ? "content" : "general"}`, limit: content && mutation ? 20 : 100, windowMs: MINUTE, tier: "ip" }];
  }

  const buckets: Bucket[] = [];
  if (isSaleWrite(method, pathname)) {
    buckets.push({ key: `rl:user:${userId}:sale`, limit: 20, windowMs: MINUTE, tier: "user" });
    buckets.push({ key: `rl:ip:${ip}:sale`, limit: 200, windowMs: MINUTE, tier: "ip" });
  } else {
    // 300/min is well above a busy till's live search; the address ceiling covers a whole shop.
    buckets.push({ key: `rl:user:${userId}:general`, limit: 300, windowMs: MINUTE, tier: "user" });
    buckets.push({ key: `rl:ip:${ip}:general`, limit: 1500, windowMs: MINUTE, tier: "ip" });
  }
  return buckets;
}

/** Counts a request against every bucket; refused if any is over. Reports the tightest. */
export async function consume(store: RateLimitStore, buckets: Bucket[]): Promise<ConsumeResult> {
  const hits = await Promise.all(buckets.map(async (b) => ({ b, hit: await store.hit(b.key, b.windowMs) })));

  let worst = hits[0]!;
  let allowed = true;
  for (const h of hits) {
    const remaining = h.b.limit - h.hit.count;
    if (remaining < 0) allowed = false;
    if (remaining < worst.b.limit - worst.hit.count) worst = h;
  }
  const remaining = Math.max(0, worst.b.limit - worst.hit.count);
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((worst.hit.resetAt - Date.now()) / 1000));
  return {
    allowed,
    limit: worst.b.limit,
    remaining,
    resetTime: Math.ceil(worst.hit.resetAt / 1000),
    retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
  };
}

/** Fixed-window counters in memory. Per server instance only. */
export function memoryStore(now: () => number = () => Date.now()): RateLimitStore {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key, windowMs) {
      const t = now();
      if (windows.size > 20_000) for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        w = { count: 0, resetAt: t + windowMs };
        windows.set(key, w);
      }
      w.count += 1;
      return { count: w.count, resetAt: w.resetAt };
    },
  };
}

/**
 * Shared counters in Upstash Redis via its REST pipeline (no SDK, works at the
 * edge). If Redis is unreachable it counts locally instead, so an outage
 * neither locks everyone out nor switches limiting off.
 */
export function upstashStore(opts: {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  fallback?: RateLimitStore;
}): RateLimitStore {
  const doFetch = opts.fetchImpl ?? fetch;
  const fallback = opts.fallback ?? memoryStore();
  return {
    async hit(key, windowMs) {
      try {
        const res = await doFetch(`${opts.url.replace(/\/+$/, "")}/pipeline`, {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
          body: JSON.stringify([["INCR", key], ["PEXPIRE", key, String(windowMs), "NX"], ["PTTL", key]]),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 400),
        });
        if (!res.ok) throw new Error(`redis ${res.status}`);
        const rows = (await res.json()) as Array<{ result?: number }>;
        const count = Number(rows[0]?.result);
        const ttl = Number(rows[2]?.result);
        if (!Number.isFinite(count)) throw new Error("bad redis reply");
        return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
      } catch {
        return fallback.hit(key, windowMs);
      }
    },
  };
}

/** Redis when configured, otherwise in memory. */
export function createRateLimitStore(env: { UPSTASH_REDIS_REST_URL?: string; UPSTASH_REDIS_REST_TOKEN?: string }): RateLimitStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? upstashStore({ url, token }) : memoryStore();
}
