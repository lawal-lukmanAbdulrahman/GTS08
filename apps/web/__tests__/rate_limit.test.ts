// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { consume, memoryStore, planBuckets, upstashStore, userIdFromAuthHeader, type Bucket } from "@gts/utils";

const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";
const jwt = (sub: unknown) => "Bearer " + ["e30", Buffer.from(JSON.stringify({ sub })).toString("base64url"), "sig"].join(".");
const find = (b: Bucket[], tier: string) => b.filter((x) => x.tier === tier);

describe("userIdFromAuthHeader (used only to choose a bucket; the route still verifies the token)", () => {
  it("reads the user id from a bearer token", () => expect(userIdFromAuthHeader(jwt(UID_A))).toBe(UID_A));
  it.each([[null], [""], ["Basic abc"], ["Bearer nodots"], [jwt("not-a-uuid")], [jwt(undefined)], ["Bearer a.%%%.c"]])("ignores %s", (h) => expect(userIdFromAuthHeader(h as string | null)).toBeNull());
});

describe("planBuckets for public routes that can be abused", () => {
  const ip: { ip: string; userId: string | null } = { ip: "9.9.9.9", userId: null };
  const limitOf = (method: string, path: string, caller = ip) => planBuckets(method, path, caller).map((b) => [b.limit, b.windowMs]);
  it("allows a support ticket 3 times in 10 minutes per address", () => {
    expect(limitOf("POST", "/api/v1/tickets")).toEqual([[3, 600_000]]);
    expect(limitOf("POST", "/api/v1/tickets", { ip: "9.9.9.9", userId: UID_A })[0]).toEqual([3, 600_000]);
  });
  it("slows promo code guessing to 20 a minute", () => {
    expect(limitOf("POST", "/api/v1/promos/validate")).toEqual([[20, 60_000]]);
  });
  it("allows 30 cart additions a minute", () => {
    expect(limitOf("POST", "/api/v1/cart/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items")).toEqual([[30, 60_000]]);
  });
  it("leaves reading the cart on the general limit", () => {
    expect(limitOf("GET", "/api/v1/cart/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")[0]![0]).toBe(100);
  });
});

describe("planBuckets", () => {
  it("a signed-in cashier's searches are counted per person, with a shared per-address ceiling above it", () => {
    const b = planBuckets("GET", "/api/v1/pos/products/search", { ip: "1.1.1.1", userId: UID_A });
    expect(find(b, "user").length).toBe(1);
    expect(find(b, "user")[0]!.key).toContain(UID_A);
    expect(find(b, "user")[0]!.limit).toBeGreaterThanOrEqual(120); // a live search box must not trip it
    expect(find(b, "ip").length).toBe(1);
    expect(find(b, "ip")[0]!.limit).toBeGreaterThan(find(b, "user")[0]!.limit);
  });

  it("two cashiers on the same address get separate personal buckets", () => {
    const a = planBuckets("POST", "/api/v1/pos/orders", { ip: "9.9.9.9", userId: UID_A });
    const b = planBuckets("POST", "/api/v1/pos/orders", { ip: "9.9.9.9", userId: UID_B });
    expect(find(a, "user")[0]!.key).not.toBe(find(b, "user")[0]!.key);
  });

  it("creating a sale is limited to 20 a minute per cashier", () => {
    const b = planBuckets("POST", "/api/v1/pos/orders", { ip: "1.1.1.1", userId: UID_A });
    expect(find(b, "user").find((x) => x.key.includes("sale"))!.limit).toBe(20);
  });

  it("only sale-creating POS calls are tightened, not browsing, categories or receipts", () => {
    for (const path of ["/api/v1/pos/products/search", "/api/v1/pos/categories", "/api/v1/pos/orders/today", "/api/v1/pos/orders/x/receipt"]) {
      const b = planBuckets("GET", path, { ip: "1.1.1.1", userId: UID_A });
      expect(b.some((x) => x.key.includes("sale")), path).toBe(false);
    }
  });

  it("credential endpoints share a generous per-address cap (a shop's staff can all sign in)", () => {
    const b = planBuckets("POST", "/api/v1/auth/login", { ip: "1.1.1.1", userId: null });
    expect(b).toHaveLength(1);
    expect(b[0]!.limit).toBeGreaterThanOrEqual(20);
    expect(b[0]!.tier).toBe("auth");
  });

  it("session calls under /auth (me, logout, passkey lists) are not treated as credential attempts", () => {
    for (const p of ["/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/auth/passkeys/list"]) {
      expect(planBuckets("GET", p, { ip: "1.1.1.1", userId: UID_A }).some((x) => x.tier === "auth"), p).toBe(false);
    }
  });

  it("an anonymous caller is limited by address alone", () => {
    const b = planBuckets("GET", "/api/v1/products", { ip: "5.5.5.5", userId: null });
    expect(b.every((x) => x.tier === "ip")).toBe(true);
    expect(b[0]!.limit).toBe(100);
  });

  it("guest checkout stays tightly limited per address", () => {
    const b = planBuckets("POST", "/api/v1/checkout", { ip: "5.5.5.5", userId: null });
    expect(b[0]!.limit).toBeLessThanOrEqual(15);
  });

  it("inventing user ids can't dodge the limit: the address ceiling is always present", () => {
    for (const path of ["/api/v1/pos/orders", "/api/v1/products", "/api/v1/inquiries"]) {
      expect(planBuckets("POST", path, { ip: "6.6.6.6", userId: UID_A }).some((x) => x.tier === "ip"), path).toBe(true);
    }
  });
});

describe("consume + stores", () => {
  it("allows up to the limit and then refuses with a retry time", async () => {
    const store = memoryStore(() => 1_000_000);
    const bucket: Bucket = { key: "k", limit: 3, windowMs: 60_000, tier: "user" };
    for (let i = 0; i < 3; i++) expect((await consume(store, [bucket])).allowed).toBe(true);
    const blocked = await consume(store, [bucket]);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);
  });

  it("the window resets after it passes", async () => {
    let now = 0;
    const store = memoryStore(() => now);
    const bucket: Bucket = { key: "k", limit: 1, windowMs: 1000, tier: "ip" };
    await consume(store, [bucket]);
    expect((await consume(store, [bucket])).allowed).toBe(false);
    now = 1500;
    expect((await consume(store, [bucket])).allowed).toBe(true);
  });

  it("refuses when ANY bucket is over, and reports the tighter one", async () => {
    const store = memoryStore(() => 0);
    const user: Bucket = { key: "u", limit: 1, windowMs: 60_000, tier: "user" };
    const ip: Bucket = { key: "i", limit: 100, windowMs: 60_000, tier: "ip" };
    await consume(store, [user, ip]);
    const r = await consume(store, [user, ip]);
    expect(r.allowed).toBe(false);
    expect(r.limit).toBe(1);
  });

  it("one person's usage doesn't affect another's", async () => {
    const store = memoryStore(() => 0);
    const a: Bucket = { key: "user:a", limit: 1, windowMs: 60_000, tier: "user" };
    const b: Bucket = { key: "user:b", limit: 1, windowMs: 60_000, tier: "user" };
    await consume(store, [a]);
    expect((await consume(store, [a])).allowed).toBe(false);
    expect((await consume(store, [b])).allowed).toBe(true);
  });

  describe("upstashStore (shared across serverless instances)", () => {
    const reply = (rows: unknown[]) => Promise.resolve(new Response(JSON.stringify(rows.map((result) => ({ result }))), { status: 200 }));

    it("counts in Redis with one INCR/PEXPIRE round trip", async () => {
      const fetchImpl = vi.fn().mockImplementation(() => reply([4, 1, 42_000]));
      const store = upstashStore({ url: "https://r.example", token: "T", fetchImpl });
      const hit = await store.hit("rl:x", 60_000);
      expect(hit.count).toBe(4);
      const [url, init] = fetchImpl.mock.calls[0]!;
      expect(url).toBe("https://r.example/pipeline");
      expect(init.headers.Authorization).toBe("Bearer T");
      expect(JSON.parse(init.body)).toEqual([["INCR", "rl:x"], ["PEXPIRE", "rl:x", "60000", "NX"], ["PTTL", "rl:x"]]);
    });

    it("falls back to counting locally if Redis is unreachable, instead of blocking everyone or letting all through", async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("down"));
      const store = upstashStore({ url: "https://r.example", token: "T", fetchImpl, fallback: memoryStore(() => 0) });
      const bucket: Bucket = { key: "k", limit: 1, windowMs: 60_000, tier: "ip" };
      expect((await consume(store, [bucket])).allowed).toBe(true);
      expect((await consume(store, [bucket])).allowed).toBe(false);
    });

    it("falls back on a non-2xx answer too", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
      const store = upstashStore({ url: "https://r.example", token: "T", fetchImpl, fallback: memoryStore(() => 0) });
      expect((await store.hit("k", 1000)).count).toBe(1);
    });
  });
});
