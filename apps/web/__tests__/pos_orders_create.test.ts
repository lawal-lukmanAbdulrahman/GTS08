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

/** Per-table configurable Supabase stub. `tableConfig[table]` is a function
 * that receives the called method name + args and returns the eventual
 * `{ data, error }` (or a further chainable stub for select chains). */
type TableHandler = (calls: { method: string; args: unknown[] }[]) => any;
let tableConfig: Record<string, TableHandler> = {};
const allCalls: Record<string, { method: string; args: unknown[] }[]> = {};

function makeTableStub(table: string) {
  // Accumulate across every from(table) call, so repeated writes to one table are all visible.
  const calls = (allCalls[table] ??= []);

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
import { POST } from "../app/api/v1/pos/orders/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/pos/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function staff(overrides: { isAdmin?: boolean; can_apply_discounts?: boolean } = {}) {
  return {
    ok: true,
    user: { id: "cashier-1", email: "cashier@gts.ng" },
    role: overrides.isAdmin ? "admin" : "cashier",
    isAdmin: overrides.isAdmin ?? false,
    fullName: "Ada Cashier",
    permissions: {
      can_process_pos: true,
      can_void_orders: false,
      can_apply_discounts: overrides.can_apply_discounts ?? false,
    },
  };
}

const VALID_BODY = {
  items: [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 2 }],
  payment_method: "cash",
};

describe("POST /api/v1/pos/orders (walk-in sale, spec Part 5.2)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue(staff());
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
        data: {
          id: "order-1",
          order_number: "GTS-202609-000001",
          total: 3000000,
          status: "completed",
        },
        error: null,
      }),
      order_items: () => ({ data: null, error: null }),
      transactions: () => ({ data: null, error: null }),
      inventory: () => ({ data: null, error: null }),
      stock_movements: () => ({ data: null, error: null }),
      customers: () => ({ data: { id: "cust-1" }, error: null }),
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

  it("returns 400 for an empty cart", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, items: [] }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("EMPTY_CART");
  });

  it("returns 400 for an invalid payment method", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, payment_method: "paystack" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_PAYMENT_METHOD");
  });

  it("returns 409 with INSUFFICIENT_STOCK when a variant no longer has enough stock", async () => {
    tableConfig.product_variants = () => ({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          size: "M",
          color: "Black",
          sku: "GTS-SHIRT-M-BLK",
          price_modifier: 0,
          inventory: { quantity: 1, reserved_quantity: 0 },
          product: { id: "p1", name: "GTS Oxford Shirt", base_price: 1500000 },
        },
      ],
      error: null,
    });
    const res = await POST(makeRequest({ ...VALID_BODY, items: [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 5 }] }));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("INSUFFICIENT_STOCK");
    expect(body.details[0]).toMatchObject({ variantId: "11111111-1111-4111-8111-111111111111", requested: 5, available: 1 });
  });

  it("creates a completed walk-in order, decrements stock, and logs a sale_pos movement", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.order_number).toBe("GTS-202609-000001");

    const orderInsertCall = allCalls.orders!.find((c) => c.method === "insert");
    expect(orderInsertCall?.args[0]).toMatchObject({
      channel: "walk_in",
      status: "completed",
      cashier_id: "cashier-1",
      subtotal: 3000000,
      total: 3000000,
    });

    const txInsertCall = allCalls.transactions!.find((c) => c.method === "insert");
    expect(txInsertCall?.args[0]).toMatchObject({
      order_id: "order-1",
      payment_method: "cash",
      payment_status: "success",
      confirmed_by: "cashier-1",
      amount: 3000000,
    });

    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [
      { variantId: "11111111-1111-4111-8111-111111111111", deltaQuantity: -2, requireAvailable: 2 },
    ]);

    const movementInsertCall = allCalls.stock_movements!.find((c) => c.method === "insert");
    expect(movementInsertCall?.args[0]).toEqual([
      {
        variant_id: "11111111-1111-4111-8111-111111111111",
        delta: -2,
        reason: "sale_pos",
        order_id: "order-1",
        actor_id: "cashier-1",
      },
    ]);
  });

  it("returns 409 and creates no order when another cashier takes the stock first", async () => {
    mockAdjustAll.mockResolvedValue({
      ok: false,
      reason: "INSUFFICIENT_STOCK",
      available: 0,
      failedVariantId: "11111111-1111-4111-8111-111111111111",
    });
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("INSUFFICIENT_STOCK");
    expect(body.details[0]).toMatchObject({ variantId: "11111111-1111-4111-8111-111111111111", requested: 2, available: 0 });
    expect(allCalls.orders).toBeUndefined();
  });

  it("returns 503 when stock is too contended to update safely", async () => {
    mockAdjustAll.mockResolvedValue({ ok: false, reason: "CONTENTION", failedVariantId: "11111111-1111-4111-8111-111111111111" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("STOCK_BUSY");
  });

  it("puts the stock back if the order row cannot be created", async () => {
    tableConfig.orders = () => ({ data: null, error: { message: "db down" } });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalledWith(expect.anything(), [
      { variantId: "11111111-1111-4111-8111-111111111111", deltaQuantity: -2, requireAvailable: 2 },
    ]);
  });

  it("creates a customer record only when an email is provided", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(allCalls.customers).toBeUndefined();

    mockFrom.mockClear();
    Object.keys(allCalls).forEach((k) => delete allCalls[k]);
    await POST(makeRequest({ ...VALID_BODY, customer_email: "shopper@example.com" }));
    expect(allCalls.customers?.length).toBeGreaterThan(0);
  });

  it("records the sale in the audit log against the cashier", async () => {
    await POST(makeRequest(VALID_BODY));
    const row = allCalls.activity_logs!.find((c) => c.method === "insert")!.args[0];
    expect(row).toMatchObject({
      actor_id: "cashier-1",
      action: "pos.sale",
      target_type: "order",
      target_id: "order-1",
      changes: expect.objectContaining({ order_number: "GTS-202609-000001", total: 3000000, payment_method: "cash" }),
    });
  });

  describe("manual discount (cashier spec Part 4.2)", () => {
    const withDiscount = (manual_discount: unknown) => makeRequest({ ...VALID_BODY, manual_discount });

    it("ignores the old client-supplied discount_amount and promo_code, so nobody can grant themselves a discount", async () => {
      await POST(makeRequest({ ...VALID_BODY, discount_amount: 2999999, promo_code: "FREE" }));
      const order = allCalls.orders!.find((c) => c.method === "insert")!.args[0];
      expect(order).toMatchObject({ subtotal: 3000000, discount_amount: 0, total: 3000000 });
      expect(order).toMatchObject({ promo_code: null });
    });

    it("refuses a cashier without the discount grant, before touching stock or creating anything", async () => {
      const res = await POST(withDiscount(1000));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("PERMISSION_DENIED");
      expect(mockAdjustAll).not.toHaveBeenCalled();
      expect(allCalls.orders).toBeUndefined();
    });

    it("applies a permitted cashier's discount to the order and logs it", async () => {
      mockRequirePosAccess.mockResolvedValue(staff({ can_apply_discounts: true }));
      const res = await POST(withDiscount(300000)); // 10% of ₦30,000
      expect(res.status).toBe(200);
      expect(allCalls.orders!.find((c) => c.method === "insert")!.args[0]).toMatchObject({
        subtotal: 3000000,
        discount_amount: 300000,
        total: 2700000,
      });
      expect(allCalls.transactions!.find((c) => c.method === "insert")!.args[0]).toMatchObject({ amount: 2700000 });

      const actions = allCalls.activity_logs!.filter((c) => c.method === "insert").map((c) => (c.args[0] as any).action);
      expect(actions).toEqual(expect.arrayContaining(["pos.sale", "pos.manual_discount"]));
      const discountLog = allCalls.activity_logs!.map((c) => c.args[0] as any).find((r) => r?.action === "pos.manual_discount");
      expect(discountLog.changes).toMatchObject({ amount: 300000, subtotal: 3000000, share_bps: 1000 });
    });

    it("refuses a cashier above 20% and says what the limit is", async () => {
      mockRequirePosAccess.mockResolvedValue(staff({ can_apply_discounts: true }));
      const res = await POST(withDiscount(700000)); // 23%
      const body = await res.json();
      expect(res.status).toBe(403);
      expect(body.code).toBe("DISCOUNT_LIMIT_EXCEEDED");
      expect(body.details).toEqual({ maxAmount: 600000 });
      expect(mockAdjustAll).not.toHaveBeenCalled();
    });

    it("lets an admin discount above 20%", async () => {
      mockRequirePosAccess.mockResolvedValue(staff({ isAdmin: true }));
      const res = await POST(withDiscount(2000000));
      expect(res.status).toBe(200);
      expect(allCalls.orders!.find((c) => c.method === "insert")!.args[0]).toMatchObject({ discount_amount: 2000000, total: 1000000 });
    });

    it("rejects a malformed discount", async () => {
      mockRequirePosAccess.mockResolvedValue(staff({ isAdmin: true }));
      for (const bad of [-5, 1.5, "100"]) {
        const res = await POST(withDiscount(bad));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_DISCOUNT");
      }
    });
  });
  describe("cart line validation (QA: these used to reach the database and 500)", () => {
    const bad: Array<[string, unknown]> = [
      ["quantity 0", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 0 }]],
      ["negative quantity", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: -2 }]],
      ["fractional quantity", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 1.5 }]],
      ["string quantity", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: "2" }]],
      ["non-uuid variant", [{ variant_id: "abc", quantity: 1 }]],
    ];
    it.each(bad)("returns 400 INVALID_ITEMS for %s, before touching stock or the database", async (_n, items) => {
      mockAdjustAll.mockClear();
      const res = await POST(makeRequest({ ...VALID_BODY, items }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_ITEMS");
      expect(mockAdjustAll).not.toHaveBeenCalled();
    });
  });
});
