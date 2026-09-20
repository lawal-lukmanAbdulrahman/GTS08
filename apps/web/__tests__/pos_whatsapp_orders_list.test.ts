import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));
// The route module also imports these for POST; they aren't used by GET.
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({ adjustAll: vi.fn(), rollback: vi.fn() }));
vi.mock("../app/api/v1/_lib/activity", () => ({ logActivity: vi.fn(), clientIp: vi.fn() }));

let result: { data: unknown; error: unknown } = { data: [], error: null };
const log: Array<{ method: string; args: unknown[] }> = [];
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: () => {
      const stub: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
            return (...args: unknown[]) => {
              log.push({ method: prop, args });
              return stub;
            };
          },
        }
      );
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/whatsapp-orders/route";

const req = () => new NextRequest("http://localhost:3000/api/v1/pos/whatsapp-orders");

describe("GET /api/v1/pos/whatsapp-orders (orders waiting for payment)", () => {
  beforeEach(() => {
    log.length = 0;
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
    result = {
      data: [
        {
          id: "o2",
          order_number: "GTS-202609-000020",
          total: 8500000,
          internal_notes: "WhatsApp customer: Ngozi A. (08099998888)",
          created_at: "2026-09-19T09:00:00Z",
          cashier_id: "u9",
          items: [{ quantity: 2 }, { quantity: 1 }],
        },
      ],
      error: null,
    };
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    expect((await GET(req())).status).toBe(403);
  });

  it("lists only unpaid WhatsApp orders, newest first, capped", async () => {
    await GET(req());
    const eqs = log.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["channel", "whatsapp"]);
    expect(eqs).toContainEqual(["status", "pending_payment"]);
    expect(log.find((c) => c.method === "order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(log.find((c) => c.method === "limit")?.args[0]).toBe(50);
  });

  it("gives the customer, item count and who recorded it, so the cashier can pick the right one", async () => {
    const { data } = await (await GET(req())).json();
    expect(data).toEqual([
      {
        id: "o2",
        order_number: "GTS-202609-000020",
        total: 8500000,
        customer_name: "Ngozi A.",
        customer_phone: "08099998888",
        item_count: 3,
        recorded_by: "u9",
        created_at: "2026-09-19T09:00:00Z",
      },
    ]);
  });

  it("copes with an order that has no parsable contact note", async () => {
    result = { data: [{ ...(result.data as any[])[0], internal_notes: null }], error: null };
    const { data } = await (await GET(req())).json();
    expect(data[0].customer_name).toBeNull();
    expect(data[0].customer_phone).toBeNull();
  });

  it("reports a database error", async () => {
    result = { data: null, error: { message: "boom" } };
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("DATABASE_ERROR");
  });
});
