import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

let queryResult: { data: unknown; error: unknown } = { data: null, error: null };
function makeQueryStub() {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    maybeSingle: vi.fn(() => Promise.resolve(queryResult)),
  };
  return stub;
}
const mockFrom = vi.fn((_table: string) => makeQueryStub());
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => mockFrom(table) }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/whatsapp-orders/[orderNumber]/route";

function ctx(orderNumber: string) {
  return { params: Promise.resolve({ orderNumber }) };
}

describe("GET /api/v1/pos/whatsapp-orders/:orderNumber (cashier lookup, D001)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    const res = await GET(new NextRequest("http://localhost:3000/x"), ctx("GTS-202609-000002"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when no order matches that number", async () => {
    queryResult = { data: null, error: null };
    const res = await GET(new NextRequest("http://localhost:3000/x"), ctx("GTS-BOGUS"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/GTS-BOGUS/);
  });

  it("returns 409 when the order was already confirmed or voided", async () => {
    queryResult = {
      data: { id: "order-1", order_number: "GTS-202609-000002", channel: "whatsapp", status: "completed", items: [] },
      error: null,
    };
    const res = await GET(new NextRequest("http://localhost:3000/x"), ctx("GTS-202609-000002"));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("ORDER_NOT_PENDING");
  });

  it("returns the pending order for confirmation", async () => {
    queryResult = {
      data: {
        id: "order-1",
        order_number: "GTS-202609-000002",
        channel: "whatsapp",
        status: "pending_payment",
        total: 1500000,
        items: [{ id: "oi1", quantity: 1, unit_price: 1500000, product_snapshot: { name: "Shirt" } }],
      },
      error: null,
    };
    const res = await GET(new NextRequest("http://localhost:3000/x"), ctx("GTS-202609-000002"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.order_number).toBe("GTS-202609-000002");
    expect(body.data.items).toHaveLength(1);
  });
});
