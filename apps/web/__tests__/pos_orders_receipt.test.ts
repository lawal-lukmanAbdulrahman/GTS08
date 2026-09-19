import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

type Call = { method: string; args: unknown[] };
type TableHandler = (calls: Call[]) => any;
let tableConfig: Record<string, TableHandler> = {};
const allCalls: Record<string, Call[]> = {};

function makeTableStub(table: string) {
  const calls: Call[] = [];
  allCalls[table] = calls;
  const stub: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
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
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => makeTableStub(table) }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/orders/[id]/receipt/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest("http://localhost:3000/api/v1/pos/orders/o1/receipt");

function staff(over: { id?: string; isAdmin?: boolean } = {}) {
  return {
    ok: true,
    user: { id: over.id ?? "cashier-1", email: null },
    role: over.isAdmin ? "admin" : "cashier",
    isAdmin: over.isAdmin ?? false,
    fullName: "Ada",
    permissions: {},
  };
}

const ORDER = {
  id: "o1",
  order_number: "GTS-202609-000001",
  channel: "walk_in",
  status: "completed",
  subtotal: 3000000,
  discount_amount: 500000,
  total: 2500000,
  created_at: "2026-09-19T10:00:00Z",
  cashier_id: "cashier-1",
  internal_notes: null,
  items: [
    { quantity: 2, unit_price: 1500000, line_total: 3000000, product_snapshot: { name: "Oxford Shirt", size: "L", color: "Black" } },
  ],
};

function setup(over: { order?: unknown; owner?: string | null; payment?: string } = {}) {
  tableConfig = {
    orders: () => ({ data: over.order === undefined ? ORDER : over.order, error: null }),
    transactions: () => ({
      data: { confirmed_by: over.owner === undefined ? "cashier-1" : over.owner, payment_method: over.payment ?? "cash" },
      error: null,
    }),
    users: () => ({ data: { full_name: "Ada Obi" }, error: null }),
    activity_logs: () => ({ data: null, error: null }),
  };
}

describe("GET /api/v1/pos/orders/[id]/receipt (reprint)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue(staff());
    for (const k of Object.keys(allCalls)) delete allCalls[k];
  });

  it("is refused without POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ code: "POS_ACCESS_DENIED" }, { status: 403 }) });
    setup();
    expect((await GET(req(), ctx("o1"))).status).toBe(403);
  });

  it("404s an order that doesn't exist", async () => {
    setup({ order: null });
    const res = await GET(req(), ctx("nope"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("ORDER_NOT_FOUND");
  });

  it("returns the receipt data for the cashier's own sale, marked as a duplicate", async () => {
    setup();
    const res = await GET(req(), ctx("o1"));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({
      orderNumber: "GTS-202609-000001",
      subtotal: 3000000,
      discountAmount: 500000,
      total: 2500000,
      paymentMethod: "cash",
      cashierName: "Ada Obi",
      channel: "walk_in",
      duplicate: true,
    });
    expect(data.items).toEqual([
      { name: "Oxford Shirt", size: "L", color: "Black", quantity: 2, unitPrice: 1500000, lineTotal: 3000000 },
    ]);
  });

  it("does not invent how much cash was handed over", async () => {
    setup();
    const { data } = await (await GET(req(), ctx("o1"))).json();
    expect(data.cashReceived).toBeUndefined();
  });

  it("carries a WhatsApp customer's name and phone", async () => {
    setup({ order: { ...ORDER, channel: "whatsapp", internal_notes: "WhatsApp customer: Ngozi (08031234567)" } });
    const { data } = await (await GET(req(), ctx("o1"))).json();
    expect(data.channel).toBe("whatsapp");
    expect(data.customerName).toBe("Ngozi");
    expect(data.customerPhone).toBe("08031234567");
  });

  it("refuses a cashier reprinting someone else's sale", async () => {
    setup({ owner: "cashier-2" });
    const res = await GET(req(), ctx("o1"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOT_YOUR_SALE");
  });

  it("lets an admin reprint anyone's sale", async () => {
    mockRequirePosAccess.mockResolvedValue(staff({ id: "admin-1", isAdmin: true }));
    setup({ owner: "cashier-2" });
    expect((await GET(req(), ctx("o1"))).status).toBe(200);
  });

  it("won't reprint a receipt for a sale that isn't completed", async () => {
    setup({ order: { ...ORDER, status: "voided" } });
    const res = await GET(req(), ctx("o1"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_PRINTABLE");
  });

  it("audits every reprint", async () => {
    setup();
    await GET(req(), ctx("o1"));
    const insert = allCalls.activity_logs?.find((c) => c.method === "insert");
    expect(insert?.args[0]).toMatchObject({ actor_id: "cashier-1", action: "pos.receipt_reprint", target_type: "order", target_id: "o1" });
  });

  it("does not audit a refused reprint", async () => {
    setup({ owner: "cashier-2" });
    await GET(req(), ctx("o1"));
    expect(allCalls.activity_logs).toBeUndefined();
  });
});
