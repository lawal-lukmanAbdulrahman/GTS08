// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
}));

import { NextRequest } from "next/server";
import { GET as overview } from "../app/api/v1/analytics/overview/route";
import { GET as sales } from "../app/api/v1/analytics/sales/route";
import { GET as split } from "../app/api/v1/analytics/channel-split/route";
import { GET as top } from "../app/api/v1/analytics/products/top/route";
import { GET as alerts } from "../app/api/v1/analytics/inventory/alerts/route";
import { GET as newCustomers } from "../app/api/v1/analytics/customers/new/route";
import { GET as aov } from "../app/api/v1/analytics/orders/average-value/route";

const call = (h: (r: NextRequest) => Promise<Response>, qs = "") => h(new NextRequest(`http://localhost:3000/api/v1/analytics/x${qs}`));
const now = () => new Date().toISOString();

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  db.results.orders = { data: [{ total: 1000, channel: "online", created_at: now() }, { total: 500, channel: "walk_in", created_at: now() }], error: null, count: 2 };
  db.results.order_items = { data: [{ quantity: 2, line_total: 200, product_snapshot: { id: "a", name: "A" } }, { quantity: 5, line_total: 500, product_snapshot: { id: "b", name: "B" } }], error: null };
  db.results.inventory = { data: [{ quantity: 0, reserved_quantity: 0, low_stock_threshold: 5, variant: { id: "v1", size: "M", color: "Black", product: { name: "Shirt", slug: "shirt" } } }, { quantity: 4, reserved_quantity: 0, low_stock_threshold: 5, variant: { id: "v2", size: "L", color: "Black", product: { name: "Shirt", slug: "shirt" } } }, { quantity: 50, reserved_quantity: 0, low_stock_threshold: 5, variant: { id: "v3", size: null, color: null, product: { name: "Hat", slug: "hat" } } }], error: null };
  db.results.customers = { data: [{ created_at: now() }, { created_at: now() }], error: null, count: 2 };
  db.results.users = { data: null, error: null, count: 3 };
  db.results.products = { data: [], error: null };
});

describe.each([
  ["overview", overview], ["sales", sales], ["channel-split", split], ["products/top", top], ["inventory/alerts", alerts], ["customers/new", newCustomers], ["orders/average-value", aov],
] as const)("analytics/%s", (_name, handler) => {
  it("is for admins only", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await call(handler)).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
  it("is never cached", async () => {
    expect((await call(handler)).headers.get("Cache-Control")).toBe("no-store");
  });
  it("hides internal errors", async () => {
    db.results.orders = { data: null, error: { message: "relation secret_t missing" } };
    db.results.inventory = { data: null, error: { message: "relation secret_t missing" } };
    db.results.customers = { data: null, error: { message: "relation secret_t missing" } };
    db.results.order_items = { data: null, error: { message: "relation secret_t missing" } };
    const res = await call(handler);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
});

describe.each([["overview", overview], ["sales", sales], ["channel-split", split], ["products/top", top], ["customers/new", newCustomers], ["orders/average-value", aov]] as const)("analytics/%s period", (_n, handler) => {
  it("rejects a bad period", async () => {
    expect((await call(handler, "?period=forever")).status).toBe(400);
    expect((await call(handler, "?period=custom&from=2026-09-05&to=2026-09-01")).status).toBe(400);
  });
});

describe("overview", () => {
  it("gives the period's revenue and orders by channel, the average, and the earlier-period change", async () => {
    const { data } = await (await call(overview, "?period=7d")).json();
    expect(data.period).toBe("7d");
    expect(data.revenue).toMatchObject({ total: 1500, online: 1000, walkin: 500 });
    expect(data.revenue.change_pct).toBe(0);
    expect(data.orders.total).toBe(2);
    expect(data.average_order_value).toBe(750);
    expect(data.low_stock_variants).toBe(2);
  });
  it("keeps the fields the dashboard already reads", async () => {
    const { data } = await (await call(overview)).json();
    expect(data.kpis).toHaveProperty("total_revenue_kobo");
    expect(data).toHaveProperty("recent_orders");
    expect(data).toHaveProperty("top_products");
  });
});

describe("sales", () => {
  it("returns a row per day, optionally for one channel", async () => {
    const { data } = await (await call(sales, "?period=today&channel=online")).json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({ revenue: expect.any(Number), orders: expect.any(Number) });
    expect(db.called("orders", "eq")!.args).toEqual(["channel", "online"]);
  });
  it("rejects an unknown channel", async () => {
    expect((await call(sales, "?channel=carrier-pigeon")).status).toBe(400);
  });
});

describe("channel-split", () => {
  it("splits revenue and orders by channel", async () => {
    const { data } = await (await call(split)).json();
    expect(data.online).toEqual({ revenue: 1000, orders: 1 });
    expect(data.walk_in).toEqual({ revenue: 500, orders: 1 });
    expect(data.whatsapp).toEqual({ revenue: 0, orders: 0 });
  });
});

describe("products/top", () => {
  it("ranks by units and clamps the limit", async () => {
    const { data } = await (await call(top, "?limit=1")).json();
    expect(data).toEqual([{ product_id: "b", name: "B", units: 5, revenue: 500 }]);
    expect((await call(top, "?limit=0")).status).toBe(400);
    expect((await call(top, "?limit=500")).status).toBe(400);
    expect((await call(top, "?limit=abc")).status).toBe(400);
  });
});

describe("inventory/alerts", () => {
  it("lists out-of-stock and low variants with their product, worst first", async () => {
    const { data } = await (await call(alerts)).json();
    expect(data.out_of_stock.map((v: { variant_id: string }) => v.variant_id)).toEqual(["v1"]);
    expect(data.low_stock.map((v: { variant_id: string }) => v.variant_id)).toEqual(["v2"]);
    expect(data.low_stock[0]).toMatchObject({ product: "Shirt", size: "L", available: 4, threshold: 5 });
  });
});

describe("customers/new", () => {
  it("counts new customers in the period against the one before", async () => {
    const { data } = await (await call(newCustomers, "?period=30d")).json();
    expect(data).toMatchObject({ period: "30d", count: 2, previous: 2, change_pct: 0 });
  });
});

describe("orders/average-value", () => {
  it("gives the average overall and by channel", async () => {
    const { data } = await (await call(aov)).json();
    expect(data).toMatchObject({ average_order_value: 750, online: 1000, walk_in: 500, whatsapp: 0 });
  });
});
