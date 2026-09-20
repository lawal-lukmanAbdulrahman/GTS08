import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosPermission: (...args: unknown[]) => mockRequirePosAccess(...args),
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
import { PUT } from "../app/api/v1/pos/orders/[id]/void/route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/pos/orders/order-1/void", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

const TODAY_ISO = new Date().toISOString();

function staff(overrides: { id?: string; isAdmin?: boolean } = {}) {
  return {
    ok: true,
    user: { id: overrides.id ?? "cashier-1", email: null },
    role: overrides.isAdmin ? "admin" : "cashier",
    isAdmin: overrides.isAdmin ?? false,
    fullName: "Ada",
    permissions: { can_process_pos: true, can_void_orders: true, can_apply_discounts: false },
  };
}

describe("PUT /api/v1/pos/orders/:id/void (spec Part 6)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue(staff());
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
        const isUpdate = calls.some((c) => c.method === "update");
        if (isUpdate) return { data: null, error: null };
        return {
          data: {
            id: "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744",
            status: "completed",
            created_at: TODAY_ISO,
            cashier_id: "cashier-1",
            items: [{ variant_id: "v1", quantity: 2 }],
          },
          error: null,
        };
      },
      inventory: () => ({ data: null, error: null }),
      stock_movements: () => ({ data: null, error: null }),
    };
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when no reason is given", async () => {
    const res = await PUT(makeRequest({}), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("REASON_REQUIRED");
  });

  it("returns 404 when the order does not exist", async () => {
    tableConfig.orders = () => ({ data: null, error: null });
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("ea21841d-a70e-4405-8f19-fabc4ff8bdd9"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the order is not from today", async () => {
    tableConfig.orders = (calls) => {
      if (calls.some((c) => c.method === "update")) return { data: null, error: null };
      return {
        data: {
          id: "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744",
          status: "completed",
          created_at: "2020-01-01T00:00:00.000Z",
          cashier_id: "cashier-1",
          items: [],
        },
        error: null,
      };
    };
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("NOT_TODAYS_ORDER");
  });

  it("voids the order, restores inventory, and logs a void stock movement", async () => {
    const res = await PUT(makeRequest({ reason: "customer changed mind" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("voided");

    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744",
      "completed",
      expect.objectContaining({ status: "voided", internal_notes: "customer changed mind" })
    );
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [{ variantId: "v1", deltaQuantity: 2 }]);

    const movementInsertCall = allCalls.stock_movements!.find((c) => c.method === "insert");
    expect(movementInsertCall?.args[0]).toEqual([
      {
        variant_id: "v1",
        delta: 2,
        reason: "void",
        order_id: "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744",
        actor_id: "cashier-1",
        notes: "customer changed mind",
      },
    ]);
  });

  it("refuses to void an order that is not completed (e.g. still pending)", async () => {
    tableConfig.orders = () => ({
      data: { id: "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744", status: "pending_payment", created_at: TODAY_ISO, cashier_id: "cashier-1", items: [] },
      error: null,
    });
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_VOIDABLE");
  });

  it("does not restock twice when two voids race", async () => {
    mockTransition.mockResolvedValue(false);
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    expect(res.status).toBe(409);
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });

  it("requires the void permission, not just POS access", async () => {
    await PUT(makeRequest({ reason: "wrong item" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    expect(mockRequirePosAccess).toHaveBeenCalledWith(expect.anything(), "can_void_orders");
  });

  describe("only your own sales (admins may void any)", () => {
    // A WhatsApp order recorded by ana but paid at the till by ben.
    const paidByBen = () => {
      tableConfig.transactions = () => ({ data: { confirmed_by: "ben" }, error: null });
      const base = tableConfig.orders!;
      tableConfig.orders = (calls) => {
        const r = base(calls);
        return r.data?.items ? { ...r, data: { ...r.data, cashier_id: "ana" } } : r;
      };
    };

    it("refuses a cashier voiding a sale someone else took payment for", async () => {
      paidByBen();
      mockRequirePosAccess.mockResolvedValue(staff({ id: "cashier-9" }));
      const res = await PUT(makeRequest({ reason: "x" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("NOT_YOUR_SALE");
      expect(mockTransition).not.toHaveBeenCalled();
      expect(mockAdjustAll).not.toHaveBeenCalled();
    });

    it("goes by who took the payment, not who recorded the order", async () => {
      paidByBen();
      mockRequirePosAccess.mockResolvedValue(staff({ id: "ana" })); // recorded it, didn't take payment
      expect((await PUT(makeRequest({ reason: "x" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"))).status).toBe(403);

      mockRequirePosAccess.mockResolvedValue(staff({ id: "ben" }));
      expect((await PUT(makeRequest({ reason: "x" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"))).status).toBe(200);
    });

    it("lets an admin void anyone's sale", async () => {
      paidByBen();
      mockRequirePosAccess.mockResolvedValue(staff({ id: "boss", isAdmin: true }));
      expect((await PUT(makeRequest({ reason: "x" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"))).status).toBe(200);
    });
  });

  it("records the void in the audit log with the reason", async () => {
    await PUT(makeRequest({ reason: "customer changed mind" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
    const row = allCalls.activity_logs!.find((c) => c.method === "insert")!.args[0];
    expect(row).toMatchObject({
      actor_id: "cashier-1",
      action: "pos.void",
      target_type: "order",
      target_id: "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744",
      changes: expect.objectContaining({ reason: "customer changed mind" }),
    });
  });

  describe("'same day' is a Lagos day", () => {
    afterEach(() => vi.useRealTimers());
    const orderAt = (created_at: string) => {
      tableConfig.orders = () => ({
        data: { id: "6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744", status: "completed", created_at, cashier_id: "cashier-1", items: [{ variant_id: "v1", quantity: 1 }] },
        error: null,
      });
    };

    it("allows voiding a sale from 00:30 Lagos time at 01:10 Lagos time, even though UTC is on a different date", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-19T00:10:00Z"));
      orderAt("2026-09-18T23:30:00Z");
      expect((await PUT(makeRequest({ reason: "x" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"))).status).toBe(200);
    });

    it("refuses a sale from 23:30 the previous Lagos day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-19T00:10:00Z"));
      orderAt("2026-09-18T22:30:00Z");
      const res = await PUT(makeRequest({ reason: "x" }), ctx("6e7f85a9-d0fe-4b5d-8b50-4c6f2991d744"));
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("NOT_TODAYS_ORDER");
    });
  });
});

