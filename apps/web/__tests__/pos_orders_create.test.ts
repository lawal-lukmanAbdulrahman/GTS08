import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

/** Per-table configurable Supabase stub. `tableConfig[table]` is a function
 * that receives the called method name + args and returns the eventual
 * `{ data, error }` (or a further chainable stub for select chains). */
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
import { POST } from "../app/api/v1/pos/orders/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/pos/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  items: [{ variant_id: "v1", quantity: 2 }],
  payment_method: "cash",
};

describe("POST /api/v1/pos/orders (walk-in sale, spec Part 5.2)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({
      ok: true,
      user: { id: "cashier-1", email: "cashier@gts.ng" },
      role: "cashier",
    });
    mockFrom.mockClear();
    tableConfig = {
      product_variants: () => ({
        data: [
          {
            id: "v1",
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
          id: "v1",
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
    const res = await POST(makeRequest({ ...VALID_BODY, items: [{ variant_id: "v1", quantity: 5 }] }));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("INSUFFICIENT_STOCK");
    expect(body.details[0]).toMatchObject({ variantId: "v1", requested: 5, available: 1 });
  });

  it("creates a completed walk-in order, decrements stock, and logs a sale_pos movement", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.order_number).toBe("GTS-202609-000001");

    const orderInsertCall = allCalls.orders.find((c) => c.method === "insert");
    expect(orderInsertCall?.args[0]).toMatchObject({
      channel: "walk_in",
      status: "completed",
      cashier_id: "cashier-1",
      subtotal: 3000000,
      total: 3000000,
    });

    const txInsertCall = allCalls.transactions.find((c) => c.method === "insert");
    expect(txInsertCall?.args[0]).toMatchObject({
      order_id: "order-1",
      payment_method: "cash",
      payment_status: "success",
      confirmed_by: "cashier-1",
      amount: 3000000,
    });

    const invUpdateCall = allCalls.inventory.find((c) => c.method === "update");
    expect(invUpdateCall?.args[0]).toMatchObject({ quantity: 8 }); // 10 - 2

    const movementInsertCall = allCalls.stock_movements.find((c) => c.method === "insert");
    expect(movementInsertCall?.args[0]).toMatchObject({
      variant_id: "v1",
      delta: -2,
      reason: "sale_pos",
      order_id: "order-1",
      actor_id: "cashier-1",
    });
  });

  it("creates a customer record only when an email is provided", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(allCalls.customers).toBeUndefined();

    mockFrom.mockClear();
    Object.keys(allCalls).forEach((k) => delete allCalls[k]);
    await POST(makeRequest({ ...VALID_BODY, customer_email: "shopper@example.com" }));
    expect(allCalls.customers?.length).toBeGreaterThan(0);
  });
});
