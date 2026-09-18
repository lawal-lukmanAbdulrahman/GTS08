import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
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

describe("PUT /api/v1/pos/orders/:id/void (spec Part 6)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({
      ok: true,
      user: { id: "cashier-1", email: null },
      role: "cashier",
    });
    mockFrom.mockClear();
    Object.keys(allCalls).forEach((k) => delete allCalls[k]);
    tableConfig = {
      orders: (calls) => {
        const isUpdate = calls.some((c) => c.method === "update");
        if (isUpdate) return { data: null, error: null };
        return {
          data: {
            id: "order-1",
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
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("order-1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when no reason is given", async () => {
    const res = await PUT(makeRequest({}), ctx("order-1"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("REASON_REQUIRED");
  });

  it("returns 404 when the order does not exist", async () => {
    tableConfig.orders = () => ({ data: null, error: null });
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the order is not from today", async () => {
    tableConfig.orders = (calls) => {
      if (calls.some((c) => c.method === "update")) return { data: null, error: null };
      return {
        data: {
          id: "order-1",
          status: "completed",
          created_at: "2020-01-01T00:00:00.000Z",
          cashier_id: "cashier-1",
          items: [],
        },
        error: null,
      };
    };
    const res = await PUT(makeRequest({ reason: "wrong item" }), ctx("order-1"));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("NOT_TODAYS_ORDER");
  });

  it("voids the order, restores inventory, and logs a void stock movement", async () => {
    const res = await PUT(makeRequest({ reason: "customer changed mind" }), ctx("order-1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("voided");

    const orderUpdateCall = allCalls.orders.find((c) => c.method === "update");
    expect(orderUpdateCall?.args[0]).toMatchObject({
      status: "voided",
      internal_notes: "customer changed mind",
    });

    const movementInsertCall = allCalls.stock_movements.find((c) => c.method === "insert");
    expect(movementInsertCall?.args[0]).toMatchObject({
      variant_id: "v1",
      delta: 2,
      reason: "void",
      order_id: "order-1",
      actor_id: "cashier-1",
    });
  });
});
