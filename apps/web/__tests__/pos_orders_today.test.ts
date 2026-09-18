import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };
function makeQueryStub() {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    in: vi.fn(() => stub),
    gte: vi.fn(() => stub),
    order: vi.fn(() => stub),
    then: (resolve: (v: typeof queryResult) => void) => resolve(queryResult),
  };
  return stub;
}
const mockFrom = vi.fn(() => makeQueryStub());
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/orders/today/route";

describe("GET /api/v1/pos/orders/today (spec Part 6)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({
      ok: true,
      user: { id: "cashier-1", email: null },
      role: "cashier",
    });
    mockFrom.mockClear();
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/pos/orders/today"));
    expect(res.status).toBe(403);
  });

  it("scopes results to today's walk-in/whatsapp orders created by this cashier", async () => {
    queryResult = {
      data: [
        {
          id: "o1",
          order_number: "GTS-202609-000001",
          status: "completed",
          total: 3000000,
          created_at: new Date().toISOString(),
          items: [{ id: "oi1", quantity: 2, product_snapshot: { name: "Shirt" } }],
        },
      ],
      error: null,
    };
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/pos/orders/today"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].order_number).toBe("GTS-202609-000001");
  });
});
