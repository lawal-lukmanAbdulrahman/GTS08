// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createDataModeReader, createScopedFetch, SCOPED_TABLES, type DataMode } from "../../../packages/database/src/data-scope";

const BASE = "https://proj.supabase.co";

function harness(mode: DataMode | null) {
  const calls: Array<{ url: string; method: string }> = [];
  const base = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET" });
    return new Response("[]", { status: 200 });
  });
  const scoped = createScopedFetch(base as unknown as typeof fetch, async () => mode);
  return { scoped, calls };
}

describe("scoped fetch", () => {
  it.each(["GET", "PATCH", "DELETE"])("limits a %s on a business table to live rows in live mode", async (method) => {
    const { scoped, calls } = harness("live");
    await scoped(`${BASE}/rest/v1/orders?select=*&status=eq.paid`, { method });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("is_test")).toBe("eq.false");
    expect(url.searchParams.get("status")).toBe("eq.paid");
  });

  it("limits reads to test rows in test mode", async () => {
    const { scoped, calls } = harness("test");
    await scoped(`${BASE}/rest/v1/customers?select=id`);
    expect(new URL(calls[0]!.url).searchParams.get("is_test")).toBe("eq.true");
  });

  it("leaves inserts alone: the database stamps new rows with the current mode", async () => {
    const { scoped, calls } = harness("live");
    await scoped(`${BASE}/rest/v1/orders`, { method: "POST", body: "{}" });
    expect(calls[0]!.url).toBe(`${BASE}/rest/v1/orders`);
  });

  it.each(["products", "product_variants", "inventory", "settings", "users", "cart_sessions", "wishlists", "webhook_events"])("leaves the shared table %s alone", async (table) => {
    const { scoped, calls } = harness("live");
    await scoped(`${BASE}/rest/v1/${table}?select=*`);
    expect(calls[0]!.url).toBe(`${BASE}/rest/v1/${table}?select=*`);
  });

  it("leaves functions and auth calls alone", async () => {
    const { scoped, calls } = harness("live");
    await scoped(`${BASE}/rest/v1/rpc/orders`, { method: "POST" });
    await scoped(`${BASE}/auth/v1/admin/users`);
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/rest/v1/rpc/orders`, `${BASE}/auth/v1/admin/users`]);
  });

  it("does not add the filter twice when the caller already chose one", async () => {
    const { scoped, calls } = harness("live");
    await scoped(`${BASE}/rest/v1/orders?is_test=eq.true`);
    expect(new URL(calls[0]!.url).searchParams.getAll("is_test")).toEqual(["eq.true"]);
  });

  it("applies no filter when the mode is unknown (migration not applied yet)", async () => {
    const { scoped, calls } = harness(null);
    await scoped(`${BASE}/rest/v1/orders?select=*`);
    expect(calls[0]!.url).toBe(`${BASE}/rest/v1/orders?select=*`);
  });

  it("keeps the caller's headers and body", async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("[]"));
    const s = createScopedFetch(base as unknown as typeof fetch, async () => "live");
    const init = { method: "PATCH", headers: { Prefer: "return=representation" }, body: '{"a":1}' };
    await s(`${BASE}/rest/v1/orders?id=eq.1`, init);
    expect(base.mock.calls[0]![1]).toBe(init);
  });

  it("covers exactly the business tables", () => {
    expect([...SCOPED_TABLES].sort()).toEqual(
      ["activity_logs", "addresses", "admin_notifications", "checkout_reservations", "customers", "email_campaigns", "order_items", "orders", "promo_code_uses", "stock_movements", "support_tickets", "ticket_messages", "transactions"].sort()
    );
  });
});

describe("data mode reader", () => {
  it("reads the mode once inside the cache window", async () => {
    const read = vi.fn(async () => "live" as DataMode);
    let t = 0;
    const reader = createDataModeReader({ read, ttlMs: 5000, now: () => t });
    expect(await reader.get()).toBe("live");
    t = 4000;
    expect(await reader.get()).toBe("live");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads again after the window and follows a change", async () => {
    let mode: DataMode = "live";
    const read = vi.fn(async () => mode);
    let t = 0;
    const reader = createDataModeReader({ read, ttlMs: 5000, now: () => t });
    await reader.get();
    mode = "test";
    t = 6000;
    expect(await reader.get()).toBe("test");
  });

  it("forgets the cached mode on invalidate, so a switch shows at once", async () => {
    let mode: DataMode = "live";
    const reader = createDataModeReader({ read: async () => mode, ttlMs: 60_000, now: () => 0 });
    await reader.get();
    mode = "test";
    reader.invalidate();
    expect(await reader.get()).toBe("test");
  });

  it("shares one read between simultaneous requests", async () => {
    const read = vi.fn(async () => "live" as DataMode);
    const reader = createDataModeReader({ read, ttlMs: 5000, now: () => 0 });
    await Promise.all([reader.get(), reader.get(), reader.get()]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps the last known mode when a refresh fails, rather than dropping isolation", async () => {
    let fail = false;
    let t = 0;
    const reader = createDataModeReader({ read: async () => { if (fail) throw new Error("down"); return "test" as DataMode; }, ttlMs: 5000, now: () => t });
    await reader.get();
    fail = true;
    t = 6000;
    expect(await reader.get()).toBe("test");
  });

  it("is null when it has never been able to read the mode", async () => {
    const reader = createDataModeReader({ read: async () => { throw new Error("no column"); }, ttlMs: 5000, now: () => 0 });
    expect(await reader.get()).toBeNull();
  });
});
