import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

const mockAdjustAll = vi.fn();
const mockRollback = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({
  adjustAll: (...args: unknown[]) => mockAdjustAll(...args),
  rollback: (...args: unknown[]) => mockRollback(...args),
}));
const mockTransition = vi.fn();
vi.mock("../app/api/v1/pos/_lib/order-status", () => ({
  transitionOrderStatus: (...args: unknown[]) => mockTransition(...args),
}));

type TableHandler = (calls: { method: string; args: unknown[] }[]) => any;
let tableConfig: Record<string, TableHandler> = {};
const allCalls: Record<string, { method: string; args: unknown[] }[]> = {};

function makeTableStub(table: string) {
  const calls: { method: string; args: unknown[] }[] = [];
  allCalls[table] = calls;
  const stub: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") {
          const result = tableConfig[table]?.(calls) ?? { data: null, error: null };
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          if (prop === "single" || prop === "maybeSingle") {
            return Promise.resolve(tableConfig[table]?.(calls) ?? { data: null, error: null });
          }
          return stub;
        };
      },
    }
  );
  return stub;
}
const mockFrom = vi.fn((table: string) => makeTableStub(table));
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => mockFrom(table) }),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/pos/whatsapp-orders/[ref]/confirm/route";

function ctx(id: string) {
  return { params: Promise.resolve({ ref: id }) };
}
function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/x", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/v1/pos/whatsapp-orders/:id/confirm (D001)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({
      ok: true,
      user: { id: "cashier-2", email: null },
      role: "cashier",
    });
    mockFrom.mockClear();
    Object.keys(allCalls).forEach((k) => delete allCalls[k]);
    mockAdjustAll.mockReset();
    mockAdjustAll.mockResolvedValue({ ok: true });
    mockRollback.mockReset();
    mockRollback.mockResolvedValue(undefined);
    mockTransition.mockReset();
    mockTransition.mockResolvedValue(true);
    tableConfig = {
      orders: (calls) => {
        if (calls.some((c) => c.method === "update")) return { data: null, error: null };
        return {
          data: {
            id: "order-1",
            status: "pending_payment",
            total: 1500000,
            order_number: "GTS-202609-000002",
            items: [{ variant_id: "v1", quantity: 1, unit_price: 1500000 }],
          },
          error: null,
        };
      },
      inventory: () => ({ data: { quantity: 10, reserved_quantity: 1 }, error: null }),
      transactions: () => ({ data: null, error: null }),
      stock_movements: () => ({ data: null, error: null }),
    };
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    const res = await POST(makeRequest({ payment_method: "cash" }), ctx("order-1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid payment method", async () => {
    const res = await POST(makeRequest({ payment_method: "paystack" }), ctx("order-1"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_PAYMENT_METHOD");
  });

  it("returns 409 when the order is no longer pending", async () => {
    tableConfig.orders = () => ({
      data: { id: "order-1", status: "completed", total: 1500000, order_number: "x", items: [] },
      error: null,
    });
    const res = await POST(makeRequest({ payment_method: "cash" }), ctx("order-1"));
    expect(res.status).toBe(409);
  });

  it("completes the order, releases the reservation, decrements stock, and records the transaction", async () => {
    const res = await POST(makeRequest({ payment_method: "pos_terminal" }), ctx("order-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("completed");

    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      "order-1",
      "pending_payment",
      expect.objectContaining({ status: "completed" })
    );

    const txInsertCall = allCalls.transactions!.find((c) => c.method === "insert");
    expect(txInsertCall?.args[0]).toMatchObject({
      order_id: "order-1",
      payment_method: "pos_terminal",
      payment_status: "success",
      confirmed_by: "cashier-2",
      amount: 1500000,
    });

    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [
      { variantId: "v1", deltaQuantity: -1, deltaReserved: -1 },
    ]);

    const movementInsertCall = allCalls.stock_movements!.find((c) => c.method === "insert");
    expect(movementInsertCall?.args[0]).toEqual([
      { variant_id: "v1", delta: -1, reason: "sale_pos", order_id: "order-1", actor_id: "cashier-2" },
    ]);
  });

  it("returns 409 and touches no stock when the order was cancelled a moment earlier", async () => {
    mockTransition.mockResolvedValue(false);
    const res = await POST(makeRequest({ payment_method: "cash" }), ctx("order-1"));
    expect(res.status).toBe(409);
    expect(mockAdjustAll).not.toHaveBeenCalled();
    expect(allCalls.transactions).toBeUndefined();
  });

  it("reopens the order and records no payment if stock cannot be updated", async () => {
    mockAdjustAll.mockResolvedValue({ ok: false, reason: "CONTENTION", failedVariantId: "v1" });
    const res = await POST(makeRequest({ payment_method: "cash" }), ctx("order-1"));
    expect(res.status).toBe(503);
    expect(mockTransition).toHaveBeenLastCalledWith(
      expect.anything(),
      "order-1",
      "completed",
      expect.objectContaining({ status: "pending_payment" })
    );
    expect(allCalls.transactions).toBeUndefined();
  });
});
