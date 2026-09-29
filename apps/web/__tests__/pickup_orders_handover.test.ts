// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse, NextRequest } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

const mockPermission = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", () => ({
  requirePermission: (...a: unknown[]) => mockPermission(...a),
}));

const mockNotify = vi.fn();
vi.mock("../app/api/v1/_lib/email/events", () => ({
  notifyOrderStatus: (...a: unknown[]) => mockNotify(...a),
}));
vi.mock("../app/api/v1/_lib/email/after", () => ({
  afterResponse: (fn: () => Promise<unknown>) => void fn(),
}));

import { POST as completePickup } from "../app/api/v1/orders/[id]/complete-pickup/route";
import { POST as markPaid } from "../app/api/v1/orders/[id]/pay/route";

const ORDER_ID = "11111111-2222-3333-4444-555555555555";
const ctx = { params: Promise.resolve({ id: ORDER_ID }) };

const makeOrder = (over: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  order_number: "GTS-202609-000500",
  channel: "pos",
  status: "ready_for_pickup",
  payment_status: "unpaid",
  payment_method: null,
  total: 5000000,
  ...over,
});

const req = (body?: unknown) =>
  new NextRequest(`http://localhost:3000/api/v1/orders/${ORDER_ID}/action`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  db.reset();
  mockPermission.mockReset().mockResolvedValue({
    ok: true,
    user: { id: "staff-1" },
    isAdmin: false,
    permissions: {
      can_complete_pickup: true,
      can_mark_orders_paid: true,
    },
  });
  mockNotify.mockReset();
  db.results.orders = { data: makeOrder(), error: null };
  db.results.activity_logs = { data: null, error: null };
});

describe("POST /api/v1/orders/[id]/complete-pickup", () => {
  it("denies access if staff member lacks can_complete_pickup", async () => {
    mockPermission.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "no" }, { status: 403 }),
    });

    const res = await completePickup(req({ payment_method: "cash" }), ctx);
    expect(res.status).toBe(403);
  });

  it("requires can_mark_orders_paid when collecting payment for an unpaid order", async () => {
    mockPermission.mockResolvedValue({
      ok: true,
      user: { id: "staff-1" },
      isAdmin: false,
      permissions: {
        can_complete_pickup: true,
        can_mark_orders_paid: false,
      },
    });

    const res = await completePickup(req({ payment_method: "cash" }), ctx);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PERMISSION_DENIED");
  });

  it("requires a valid payment method when order is unpaid", async () => {
    const res = await completePickup(req({ payment_method: "invalid_crypto" }), ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("PAYMENT_METHOD_REQUIRED");
  });

  it("verifies 6-digit collection PIN for web storefront and whatsapp orders", async () => {
    db.results.orders = {
      data: makeOrder({ channel: "web", tracking_number: "654321", payment_status: "paid" }),
      error: null,
    };

    // Missing / wrong PIN
    const failRes = await completePickup(req({ pickup_pin: "000000" }), ctx);
    expect(failRes.status).toBe(400);
    const failJson = await failRes.json();
    expect(failJson.code).toBe("INVALID_PICKUP_PIN");

    // Correct PIN
    const passRes = await completePickup(req({ pickup_pin: "654321" }), ctx);
    expect(passRes.status).toBe(200);
  });

  it("atomically accepts payment and completes pickup for unpaid order", async () => {
    db.results.orders = {
      data: makeOrder({ status: "ready_for_pickup", payment_status: "unpaid" }),
      error: null,
    };

    const res = await completePickup(req({ payment_method: "pos" }), ctx);
    expect(res.status).toBe(200);

    const updateCall = db.called("orders", "update");
    expect(updateCall).toBeTruthy();
    expect(updateCall!.args[0]).toMatchObject({
      status: "collected",
      payment_status: "paid",
      payment_method: "pos",
    });

    expect(db.called("activity_logs", "insert")).toBeTruthy();
    expect(mockNotify).toHaveBeenCalledWith(expect.anything(), ORDER_ID, "collected");
  });

  it("completes pickup directly without payment prompt if already paid", async () => {
    db.results.orders = {
      data: makeOrder({ status: "ready_for_pickup", payment_status: "paid", payment_method: "transfer" }),
      error: null,
    };

    const res = await completePickup(req({}), ctx);
    expect(res.status).toBe(200);

    const updateCall = db.called("orders", "update");
    expect(updateCall).toBeTruthy();
    expect(updateCall!.args[0]).toMatchObject({
      status: "collected",
    });
  });

  it("rejects pickup if order is already collected", async () => {
    db.results.orders = {
      data: makeOrder({ status: "collected", payment_status: "paid" }),
      error: null,
    };

    const res = await completePickup(req({}), ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("ALREADY_COLLECTED");
  });

  it("rejects pickup if order is cancelled", async () => {
    db.results.orders = {
      data: makeOrder({ status: "cancelled" }),
      error: null,
    };

    const res = await completePickup(req({}), ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_STATUS");
  });
});

describe("POST /api/v1/orders/[id]/pay", () => {
  it("denies access if staff member lacks can_mark_orders_paid", async () => {
    mockPermission.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "no" }, { status: 403 }),
    });

    const res = await markPaid(req({ payment_method: "cash" }), ctx);
    expect(res.status).toBe(403);
  });

  it("records payment method and marks payment_status paid", async () => {
    db.results.orders = {
      data: makeOrder({ status: "ready_for_pickup", payment_status: "unpaid" }),
      error: null,
    };

    const res = await markPaid(req({ payment_method: "transfer", reason: "Direct customer transfer confirmed" }), ctx);
    expect(res.status).toBe(200);

    const updateCall = db.called("orders", "update");
    expect(updateCall).toBeTruthy();
    expect(updateCall!.args[0]).toMatchObject({
      payment_status: "paid",
      payment_method: "transfer",
    });

    expect(db.called("activity_logs", "insert")).toBeTruthy();
  });
});
