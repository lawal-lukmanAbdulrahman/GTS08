// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  accessTokenFromRequest,
  BUSINESS_TABLES,
  CATALOGUE_TABLES,
  createCachedLookup,
  createScopedFetch,
  runWithDataMode,
  currentDataModeOverride,
  SCOPED_TABLES,
  subjectFromJwt,
  type Scope,
} from "../../../packages/database/src/data-scope";

const BASE = "https://proj.supabase.co";
const ALL = { tables: SCOPED_TABLES };

function harness(scope: Scope | null) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const base = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
    return new Response("[]", { status: 200 });
  });
  const scoped = createScopedFetch(base as unknown as typeof fetch, async () => scope);
  return { scoped, calls, base };
}

describe("scoped fetch: reads, updates and deletes", () => {
  it.each(["GET", "PATCH", "DELETE", "HEAD"])("limits a %s on a scoped table to live rows for a live caller", async (method) => {
    const { scoped, calls } = harness({ mode: "live", ...ALL });
    await scoped(`${BASE}/rest/v1/orders?select=*&status=eq.paid`, { method });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("is_test")).toBe("eq.false");
    expect(url.searchParams.get("status")).toBe("eq.paid");
  });

  it("limits reads to demo rows for the demo account", async () => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/products?select=id`);
    expect(new URL(calls[0]!.url).searchParams.get("is_test")).toBe("eq.true");
  });

  it.each(["products", "product_variants", "inventory", "categories", "brands", "promos", "product_flags", "content_slots", "hero_carousel"])("scopes the catalogue table %s", async (table) => {
    const { scoped, calls } = harness({ mode: "live", ...ALL });
    await scoped(`${BASE}/rest/v1/${table}?select=*`);
    expect(new URL(calls[0]!.url).searchParams.get("is_test")).toBe("eq.false");
  });

  it.each(["settings", "users", "employee_permissions", "cart_sessions", "wishlists", "webhook_events", "storefront_sections"])("leaves the shared table %s alone", async (table) => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/${table}?select=*`);
    expect(calls[0]!.url).toBe(`${BASE}/rest/v1/${table}?select=*`);
  });

  it("only scopes the tables it is told are ready (before the catalogue migration)", async () => {
    const { scoped, calls } = harness({ mode: "live", tables: BUSINESS_TABLES });
    await scoped(`${BASE}/rest/v1/products?select=id`);
    await scoped(`${BASE}/rest/v1/orders?select=id`);
    expect(calls[0]!.url).toBe(`${BASE}/rest/v1/products?select=id`);
    expect(new URL(calls[1]!.url).searchParams.get("is_test")).toBe("eq.false");
  });

  it("does nothing at all when scoping isn't available", async () => {
    const { scoped, calls } = harness(null);
    await scoped(`${BASE}/rest/v1/orders?select=*`);
    expect(calls[0]!.url).toBe(`${BASE}/rest/v1/orders?select=*`);
  });

  it("does not add the filter twice when the caller already chose one", async () => {
    const { scoped, calls } = harness({ mode: "live", ...ALL });
    await scoped(`${BASE}/rest/v1/orders?is_test=eq.true`);
    expect(new URL(calls[0]!.url).searchParams.getAll("is_test")).toEqual(["eq.true"]);
  });

  it("leaves functions and auth calls alone", async () => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/rpc/search_products`, { method: "POST", body: "{}" });
    await scoped(`${BASE}/auth/v1/admin/users`);
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/rest/v1/rpc/search_products`, `${BASE}/auth/v1/admin/users`]);
    expect(calls[0]!.body).toBe("{}");
  });

  it("keeps the caller's init for non-inserts", async () => {
    const { scoped, base } = harness({ mode: "live", ...ALL });
    const init = { method: "PATCH", headers: { Prefer: "return=representation" }, body: '{"a":1}' };
    await scoped(`${BASE}/rest/v1/orders?id=eq.1`, init);
    expect(base.mock.calls[0]![1]).toBe(init);
  });
});

describe("scoped fetch: inserts and upserts are stamped with the caller's mode", () => {
  it("stamps a single row", async () => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/orders`, { method: "POST", body: JSON.stringify({ total: 5 }) });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ total: 5, is_test: true });
  });

  it("stamps every row of a batch and adds the column to ?columns=", async () => {
    const { scoped, calls } = harness({ mode: "live", ...ALL });
    await scoped(`${BASE}/rest/v1/order_items?columns=%22order_id%22,%22quantity%22`, { method: "POST", body: JSON.stringify([{ order_id: "o", quantity: 1 }, { order_id: "o", quantity: 2 }]) });
    expect(JSON.parse(calls[0]!.body!)).toEqual([{ order_id: "o", quantity: 1, is_test: false }, { order_id: "o", quantity: 2, is_test: false }]);
    expect(new URL(calls[0]!.url).searchParams.get("columns")).toBe('"order_id","quantity","is_test"');
  });

  it("overrides an is_test the caller tried to set, so a demo request can never write live rows", async () => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/products`, { method: "POST", body: JSON.stringify({ slug: "x", is_test: false }) });
    expect(JSON.parse(calls[0]!.body!).is_test).toBe(true);
  });

  it("stamps an upsert and keeps its conflict target", async () => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/content_slots?on_conflict=slot_key%2Cis_test`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ slot_key: "broadcast" }) });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ slot_key: "broadcast", is_test: true });
    expect(new URL(calls[0]!.url).searchParams.get("on_conflict")).toBe("slot_key,is_test");
  });

  it("leaves inserts into shared tables and non-JSON bodies alone", async () => {
    const { scoped, calls } = harness({ mode: "test", ...ALL });
    await scoped(`${BASE}/rest/v1/settings`, { method: "POST", body: JSON.stringify({ a: 1 }) });
    await scoped(`${BASE}/rest/v1/orders`, { method: "POST", body: "not json" });
    expect(calls[0]!.body).toBe('{"a":1}');
    expect(calls[1]!.body).toBe("not json");
  });
});

describe("table lists", () => {
  it("business data and the catalogue are both scoped, and nothing shared is", () => {
    expect([...BUSINESS_TABLES].sort()).toEqual(["activity_logs", "addresses", "admin_notifications", "checkout_reservations", "customers", "email_campaigns", "order_items", "orders", "product_views", "promo_code_uses", "search_queries", "stock_movements", "support_tickets", "ticket_messages", "transactions"].sort());
    expect([...CATALOGUE_TABLES].sort()).toEqual(["brands", "categories", "content_slots", "hero_carousel", "inventory", "product_drafts", "product_flags", "product_images", "product_variants", "products", "promos", "reviews", "size_guides"].sort());
    expect(SCOPED_TABLES).toHaveLength(28);
  });
});

const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const UID = "11111111-2222-3333-4444-555555555555";

describe("subjectFromJwt", () => {
  it("reads the user id", () => {
    expect(subjectFromJwt(jwt({ sub: UID }))).toBe(UID);
  });
  it.each(["", "garbage", "a.b", jwt({}), jwt({ sub: "not-a-uuid" }), jwt({ sub: "1' OR 1=1" })])("is null for %j", (t) => {
    expect(subjectFromJwt(t)).toBeNull();
  });
});

describe("accessTokenFromRequest", () => {
  it("prefers the bearer token", () => {
    expect(accessTokenFromRequest("Bearer abc.def.ghi", [])).toBe("abc.def.ghi");
  });
  it("reads a Supabase session cookie, including the base64 and chunked forms", () => {
    const session = JSON.stringify({ access_token: "tok.en.x", refresh_token: "r" });
    const b64 = "base64-" + Buffer.from(session).toString("base64url");
    expect(accessTokenFromRequest(null, [{ name: "sb-proj-auth-token", value: b64 }])).toBe("tok.en.x");
    expect(accessTokenFromRequest(null, [{ name: "sb-proj-auth-token.1", value: b64.slice(20) }, { name: "sb-proj-auth-token.0", value: b64.slice(0, 20) }])).toBe("tok.en.x");
    expect(accessTokenFromRequest(null, [{ name: "sb-proj-auth-token", value: encodeURIComponent(session) }])).toBe("tok.en.x");
  });
  it("is null with no credentials or an unreadable cookie", () => {
    expect(accessTokenFromRequest(null, [])).toBeNull();
    expect(accessTokenFromRequest(null, [{ name: "sb-proj-auth-token", value: "base64-%%%" }])).toBeNull();
    expect(accessTokenFromRequest("Basic xyz", [{ name: "other", value: "1" }])).toBeNull();
  });
});

describe("createCachedLookup", () => {
  it("asks once per key inside the window, and again after it", async () => {
    const load = vi.fn(async (k: string) => k === "demo");
    let t = 0;
    const lookup = createCachedLookup(load, { ttlMs: 60_000, now: () => t });
    expect(await lookup("demo")).toBe(true);
    expect(await lookup("demo")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    t = 61_000;
    await lookup("demo");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("never caches a failure", async () => {
    let fail = true;
    const lookup = createCachedLookup(async () => { if (fail) throw new Error("down"); return true; }, { ttlMs: 60_000, now: () => 0 });
    await expect(lookup("k")).rejects.toThrow();
    fail = false;
    expect(await lookup("k")).toBe(true);
  });
  it("stays bounded", async () => {
    const lookup = createCachedLookup(async (k: string) => k, { ttlMs: 60_000, now: () => 0, max: 3 });
    for (const k of ["a", "b", "c", "d"]) await lookup(k);
    expect(lookup.size()).toBeLessThanOrEqual(3);
  });
});

describe("runWithDataMode", () => {
  it("pins the mode for work that outlives the request (emails sent after the response)", async () => {
    expect(currentDataModeOverride()).toBeUndefined();
    await runWithDataMode("test", async () => {
      await new Promise((r) => setTimeout(r, 1));
      expect(currentDataModeOverride()).toBe("test");
    });
    expect(currentDataModeOverride()).toBeUndefined();
  });
});
