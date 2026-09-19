import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

const mockAdjustAll = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({
  adjustAll: (...args: unknown[]) => mockAdjustAll(...args),
}));

const mockTransition = vi.fn();
vi.mock("../app/api/v1/pos/_lib/order-status", () => ({
  transitionOrderStatus: (...args: unknown[]) => mockTransition(...args),
}));

let orderResult: { data: unknown; error: unknown } = { data: null, error: null };
function makeQueryStub() {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    maybeSingle: vi.fn(() => Promise.resolve(orderResult)),
  };
  return stub;
}
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (_table: string) => makeQueryStub() }),
}));

import { NextRequest } from "next/server";
import { PUT } from "../app/api/v1/pos/whatsapp-orders/[ref]/cancel/route";

function ctx(id: string) {
  return { params: Promise.resolve({ ref: id }) };
}
function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/x", { method: "PUT", body: JSON.stringify(body) });
}

const PENDING_ORDER = {
  id: "order-1",
  channel: "whatsapp",
  status: "pending_payment",
  internal_notes: "WhatsApp customer: Ngozi A. (08099998888)",
  items: [
    { variant_id: "v1", quantity: 2 },
    { variant_id: "v2", quantity: 1 },
  ],
};

describe("PUT /api/v1/pos/whatsapp-orders/:id/cancel", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "cashier-1", email: null }, role: "cashier" });
    mockAdjustAll.mockReset();
    mockAdjustAll.mockResolvedValue({ ok: true });
    mockTransition.mockReset();
    mockTransition.mockResolvedValue(true);
    orderResult = { data: PENDING_ORDER, error: null };
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    const res = await PUT(makeRequest({ reason: "customer went quiet" }), ctx("order-1"));
    expect(res.status).toBe(403);
  });

  it("requires a reason", async () => {
    const res = await PUT(makeRequest({}), ctx("order-1"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("REASON_REQUIRED");
  });

  it("returns 404 for an unknown order", async () => {
    orderResult = { data: null, error: null };
    const res = await PUT(makeRequest({ reason: "x" }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("only cancels WhatsApp orders (a walk-in sale must be voided instead)", async () => {
    orderResult = { data: { ...PENDING_ORDER, channel: "walk_in", status: "completed" }, error: null };
    const res = await PUT(makeRequest({ reason: "x" }), ctx("order-1"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_CANCELLABLE");
  });

  it("refuses an order that is already paid", async () => {
    orderResult = { data: { ...PENDING_ORDER, status: "completed" }, error: null };
    const res = await PUT(makeRequest({ reason: "x" }), ctx("order-1"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ORDER_NOT_PENDING");
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });

  it("cancels the order, keeps the contact note, and records the reason", async () => {
    const res = await PUT(makeRequest({ reason: "customer went quiet" }), ctx("order-1"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("cancelled");

    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      "order-1",
      "pending_payment",
      expect.objectContaining({
        status: "cancelled",
        internal_notes: expect.stringMatching(/Ngozi A\..*customer went quiet/s),
      })
    );
  });

  it("releases the reserved stock for every line", async () => {
    await PUT(makeRequest({ reason: "customer went quiet" }), ctx("order-1"));
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [
      { variantId: "v1", deltaReserved: -2 },
      { variantId: "v2", deltaReserved: -1 },
    ]);
  });

  it("releases nothing if a cashier confirmed the order a moment earlier", async () => {
    mockTransition.mockResolvedValue(false);
    const res = await PUT(makeRequest({ reason: "x" }), ctx("order-1"));
    expect(res.status).toBe(409);
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });
});
