// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/analytics/dashboard/route";

const call = (qs = "") => GET(new NextRequest(`http://localhost/api/v1/analytics/dashboard${qs}`));

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "a" }, isAdmin: true, isDemo: false });
  for (const t of ["orders", "transactions", "products", "inventory", "product_views", "users"]) db.results[t] = { data: [], error: null };
});

describe("GET /analytics/dashboard", () => {
  it("is for admins only", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });

  it("returns every section, zeros for an empty shop, never cached", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const { data } = await res.json();
    expect(Object.keys(data).sort()).toEqual(["cards", "funnel", "period", "profits", "promos", "recent_orders", "revenue", "sizes", "staff", "unsold", "visits"].sort());
    expect(data.cards.bank_payouts.total).toBe(0);
    expect(data.revenue.series).toHaveLength(7);
  });

  it("uses the chosen period", async () => {
    expect((await (await call("?period=30d")).json()).data.revenue.series).toHaveLength(30);
    expect((await call("?period=forever")).status).toBe(400);
  });

  it("reads staff names for the cashiers in the period only, by id", async () => {
    db.results.orders = (calls) => (calls.some((c) => c.method === "gte") ? { data: [{ id: "o1", total: 5, channel: "walk_in", status: "completed", created_at: new Date().toISOString(), customer_id: null, cashier_id: "c1", discount_amount: 0, promo_code: null, items: [] }], error: null } : { data: [], error: null });
    db.results.users = { data: [{ id: "c1", full_name: "Ada" }], error: null };
    const { data } = await (await call()).json();
    expect(db.calls.users!.find((c) => c.method === "in")!.args).toEqual(["id", ["c1"]]);
    expect(data.staff[0]).toMatchObject({ name: "Ada", sales: 5 });
  });

  it("does not describe a database failure", async () => {
    db.results.orders = { data: null, error: { message: "relation secret_table does not exist" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call();
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_table/);
  });
});

describe("period boundaries", () => {
  it("puts a payment made just after the period started in the period, whatever timestamp format Postgres uses", async () => {
    const r = await (await import("../app/api/v1/_lib/analytics")).parsePeriod(new URLSearchParams({ period: "7d" }));
    if (!r.ok) throw new Error();
    const justAfter = new Date(r.period.from.getTime() + 1000).toISOString().replace("Z", "+00:00");
    db.results.transactions = { data: [{ payment_method: "paystack_card", payment_status: "success", amount: 700, created_at: justAfter }], error: null };
    const { data } = await (await call()).json();
    expect(data.cards.bank_payouts.total).toBe(700);
  });
});
