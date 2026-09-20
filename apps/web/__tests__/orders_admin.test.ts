// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
const mockPerm = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockPerm(...a),
}));
const mockAdjust = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({ adjustAll: (...a: unknown[]) => mockAdjust(...a), rollback: vi.fn() }));
const mockTransition = vi.fn();
vi.mock("../app/api/v1/pos/_lib/order-status", () => ({ transitionOrderStatus: (...a: unknown[]) => mockTransition(...a) }));
const mockNotify = vi.fn();
vi.mock("../app/api/v1/_lib/email/events", () => ({ notifyOrderStatus: (...a: unknown[]) => mockNotify(...a) }));
vi.mock("../app/api/v1/_lib/email/after", () => ({ afterResponse: (t: () => Promise<unknown>) => void t() }));

import { NextRequest } from "next/server";
import { GET, PATCH } from "../app/api/v1/orders/[id]/route";
import { PUT } from "../app/api/v1/orders/[id]/status/route";

const ID = "11111111-1111-4111-8111-111111111111";
const V1 = "22222222-2222-4222-8222-222222222222";
const ctx = { params: Promise.resolve({ id: ID }) };
const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/orders/x", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const order = (over: Record<string, unknown> = {}) => ({
  id: ID, order_number: "GTS-202609-000070", channel: "online", status: "paid", total: 3250000,
  customer: { id: "c1", full_name: "Bola", email: "bola@example.com", phone: "0801" }, items: [{ variant_id: V1, quantity: 2 }], ...over,
});

beforeEach(() => {
  db.reset();
  mockPerm.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  mockAdjust.mockReset().mockResolvedValue({ ok: true });
  mockTransition.mockReset().mockResolvedValue(true);
  mockNotify.mockReset();
  db.results.orders = { data: order(), error: null };
  db.results.stock_movements = { data: null, error: null };
});

describe("GET /orders/[id]", () => {
  it("needs can_view_all_orders", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await GET(req("GET"), ctx)).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
  it("returns the order with what can happen next", async () => {
    const { data } = await (await GET(req("GET"), ctx)).json();
    expect(data.order_number).toBe("GTS-202609-000070");
    expect(data.allowed_next).toEqual(["confirmed", "cancelled"]);
  });
  it("404s an unknown or malformed id", async () => {
    db.results.orders = { data: null, error: null };
    expect((await GET(req("GET"), ctx)).status).toBe(404);
    expect((await GET(req("GET"), { params: Promise.resolve({ id: "x" }) })).status).toBe(404);
  });
});

describe("PATCH /orders/[id] (notes and courier details, never the status)", () => {
  it("updates only the fields sent, trimmed", async () => {
    const res = await PATCH(req("PATCH", { internal_notes: " Call before delivery ", carrier_name: "GIG", tracking_number: "TRK1", status: "delivered", total: 1 }), ctx);
    expect(res.status).toBe(200);
    const patch = db.called("orders", "update")!.args[0] as Record<string, unknown>;
    expect(patch).toMatchObject({ internal_notes: "Call before delivery", carrier_name: "GIG", tracking_number: "TRK1" });
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("total");
  });
  it("validates lengths and requires an https tracking link", async () => {
    for (const body of [{ carrier_name: "x".repeat(101) }, { tracking_number: 5 }, { carrier_tracking_url: "javascript:alert(1)" }, { carrier_tracking_url: "http://plain.example" }, { internal_notes: "x".repeat(2001) }, {}]) {
      expect((await PATCH(req("PATCH", body), ctx)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await PATCH(req("PATCH", { carrier_tracking_url: "https://track.example/abc" }), ctx)).status).toBe(200);
  });
  it("is refused without the grant, and 404s a missing order", async () => {
    db.results.orders = { data: null, error: null };
    expect((await PATCH(req("PATCH", { carrier_name: "GIG" }), ctx)).status).toBe(404);
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await PATCH(req("PATCH", { carrier_name: "GIG" }), ctx)).status).toBe(403);
  });
});

describe("PUT /orders/[id]/status", () => {
  const put = (body: unknown) => PUT(req("PUT", body), ctx);

  it("needs can_view_all_orders", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await put({ status: "confirmed" })).status).toBe(403);
  });
  it("validates the request", async () => {
    expect((await put({})).status).toBe(400);
    expect((await put({ status: "teleported" })).status).toBe(400);
    expect((await PUT(req("PUT", "{nope"), ctx)).status).toBe(400);
    expect((await PUT(req("PUT", { status: "confirmed" }), { params: Promise.resolve({ id: "x" }) })).status).toBe(404);
  });
  it("moves an order forward one step, claiming it so two admins can't both act", async () => {
    const res = await put({ status: "confirmed" });
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(expect.anything(), ID, "paid", expect.objectContaining({ status: "confirmed" }));
    expect(mockNotify).toHaveBeenCalledWith(expect.anything(), ID, "confirmed");
  });
  it("refuses marking paid, skipping steps, moving backwards, and touching walk-in sales", async () => {
    db.results.orders = { data: order({ status: "pending_payment" }), error: null };
    let res = await put({ status: "paid" }); // not a status an admin may set at all
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_STATUS");
    db.results.orders = { data: order({ status: "paid" }), error: null };
    expect((await put({ status: "shipped" })).status).toBe(409);
    db.results.orders = { data: order({ status: "shipped" }), error: null };
    expect((await put({ status: "processing" })).status).toBe(409);
    db.results.orders = { data: order({ channel: "walk_in", status: "completed" }), error: null };
    res = await put({ status: "cancelled" });
    expect(res.status).toBe(409);
    expect(mockTransition).not.toHaveBeenCalled();
  });
  it("stamps the shipped date and saves courier details, validated", async () => {
    db.results.orders = { data: order({ status: "processing" }), error: null };
    expect((await put({ status: "shipped", carrier_name: "GIG", tracking_number: "T1", carrier_tracking_url: "https://t.example/1" })).status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(expect.anything(), ID, "processing", expect.objectContaining({ status: "shipped", carrier_name: "GIG", tracking_number: "T1", shipped_at: expect.any(String) }));
    expect((await put({ status: "shipped", carrier_tracking_url: "javascript:x" })).status).toBe(400);
  });
  it("cancelling an unpaid order releases the stock it held", async () => {
    db.results.orders = { data: order({ status: "pending_payment" }), error: null };
    expect((await put({ status: "cancelled" })).status).toBe(200);
    expect(mockAdjust).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaReserved: -2, clampReserved: true }]);
  });
  it("cancelling a paid order puts the stock back, records it, and says the refund is still to do", async () => {
    const res = await put({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(mockAdjust).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaQuantity: 2 }]);
    expect(db.called("stock_movements", "insert")!.args[0]).toEqual([expect.objectContaining({ variant_id: V1, delta: 2, reason: "return", order_id: ID })]);
    expect((await res.json()).data.refund_required).toBe(true);
  });
  it("says so when someone else changed the order first", async () => {
    mockTransition.mockResolvedValue(false);
    const res = await put({ status: "confirmed" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ORDER_CHANGED");
    expect(mockAdjust).not.toHaveBeenCalled();
  });
  it("undoes a cancellation if the stock can't be put back, so the two never disagree", async () => {
    mockAdjust.mockResolvedValue({ ok: false, reason: "DATABASE_ERROR", message: "boom", failedVariantId: V1 });
    const res = await put({ status: "cancelled" });
    expect(res.status).toBe(503);
    expect(mockTransition).toHaveBeenLastCalledWith(expect.anything(), ID, "cancelled", expect.objectContaining({ status: "paid" }));
  });
  it("never echoes internal errors", async () => {
    db.results.orders = { data: null, error: { message: "relation secret_t missing" } };
    const res = await put({ status: "confirmed" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
});
