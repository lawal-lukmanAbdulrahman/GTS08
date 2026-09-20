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
import { POST } from "../app/api/v1/pos/whatsapp-orders/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/pos/whatsapp-orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  items: [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
  customer_name: "Chidinma O.",
  customer_phone: "08031234567",
};

describe("POST /api/v1/pos/whatsapp-orders (create pending order, D001)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({
      ok: true,
      user: { id: "staff-1", email: "staff@gts.ng" },
      role: "cashier",
    });
    mockFrom.mockClear();
    Object.keys(allCalls).forEach((k) => delete allCalls[k]);
    mockAdjustAll.mockReset();
    mockAdjustAll.mockResolvedValue({ ok: true });
    mockRollback.mockReset();
    mockRollback.mockResolvedValue(undefined);
    tableConfig = {
      product_variants: () => ({
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            size: "M",
            color: "Black",
            sku: "GTS-SHIRT-M-BLK",
            price_modifier: 0,
            inventory: { quantity: 10, reserved_quantity: 0 },
            product: { id: "p1", name: "GTS Oxford Shirt", base_price: 1500000 },
          },
        ],
        error: null,
      }),
      orders: () => ({
        data: { id: "order-1", order_number: "GTS-202609-000002", total: 1500000, status: "pending_payment" },
        error: null,
      }),
      order_items: () => ({ data: null, error: null }),
      inventory: () => ({ data: null, error: null }),
    };
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("requires a customer name and phone (this is how the receipt gets back to them)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, customer_phone: undefined }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("CUSTOMER_CONTACT_REQUIRED");
  });

  it("returns 409 when stock is insufficient", async () => {
    tableConfig.product_variants = () => ({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          size: "M",
          color: "Black",
          sku: "GTS-SHIRT-M-BLK",
          price_modifier: 0,
          inventory: { quantity: 0, reserved_quantity: 0 },
          product: { id: "p1", name: "GTS Oxford Shirt", base_price: 1500000 },
        },
      ],
      error: null,
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("creates a pending_payment order on the whatsapp channel and reserves stock", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.order_number).toBe("GTS-202609-000002");

    const orderInsertCall = allCalls.orders!.find((c) => c.method === "insert");
    expect(orderInsertCall?.args[0]).toMatchObject({
      channel: "whatsapp",
      status: "pending_payment",
      internal_notes: expect.stringContaining("08031234567"),
    });

    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [
      { variantId: "11111111-1111-4111-8111-111111111111", deltaReserved: 1, requireAvailable: 1 },
    ]);
  });

  it("returns 409 and creates nothing if another cashier reserves the stock first", async () => {
    mockAdjustAll.mockResolvedValue({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
      available: 0,
      failedVariantId: "11111111-1111-4111-8111-111111111111",
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect(allCalls.orders).toBeUndefined();
  });

  it("releases the reservation if the order row cannot be created", async () => {
    tableConfig.orders = () => ({ data: null, error: { message: "db down" } });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalledWith(expect.anything(), [
      { variantId: "11111111-1111-4111-8111-111111111111", deltaReserved: 1, requireAvailable: 1 },
    ]);
  });

  it("records the new order in the audit log without the customer's phone number", async () => {
    await POST(makeRequest(VALID_BODY));
    const row = allCalls.activity_logs!.find((c) => c.method === "insert")!.args[0] as any;
    expect(row).toMatchObject({
      actor_id: "staff-1",
      action: "pos.whatsapp_create",
      target_type: "order",
      target_id: "order-1",
      changes: { order_number: "GTS-202609-000002", total: 1500000, item_count: 1 },
    });
    expect(JSON.stringify(row)).not.toContain("08031234567");
  });

  describe("cart line validation", () => {
    it.each([
      ["quantity 0", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 0 }]],
      ["negative quantity", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: -1 }]],
      ["fractional quantity", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 0.5 }]],
      ["non-uuid variant", [{ variant_id: "nope", quantity: 1 }]],
    ])("returns 400 INVALID_ITEMS for %s", async (_n, items) => {
      mockAdjustAll.mockClear();
      const res = await POST(makeRequest({ ...VALID_BODY, items }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_ITEMS");
      expect(mockAdjustAll).not.toHaveBeenCalled();
    });
  });
});
