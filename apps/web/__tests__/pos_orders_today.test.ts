import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };
const gteSpy = vi.fn();
function makeQueryStub() {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    in: vi.fn(() => stub),
    gte: vi.fn((...a: unknown[]) => { gteSpy(...a); return stub; }),
    order: vi.fn(() => stub),
    then: (resolve: (v: typeof queryResult) => void) => resolve(queryResult),
  };
  return stub;
}
const mockFrom = vi.fn((_table: string) => makeQueryStub());
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => mockFrom(table) }),
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

  describe("'today' is a Lagos day, whatever timezone the server runs in", () => {
    afterEach(() => vi.useRealTimers());

    it("starts at midnight WAT (23:00 UTC the evening before)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-19T00:10:00Z")); // 01:10 in Lagos, still the 19th there
      await GET(new NextRequest("http://localhost:3000/api/v1/pos/orders/today"));
      expect(gteSpy).toHaveBeenCalledWith("created_at", "2026-09-18T23:00:00.000Z");
    });

    it("is not thrown off by a 23:30 Lagos sale (22:30 UTC) when it's already the next UTC day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-19T22:30:00Z")); // 23:30 in Lagos on the 19th
      await GET(new NextRequest("http://localhost:3000/api/v1/pos/orders/today"));
      expect(gteSpy).toHaveBeenLastCalledWith("created_at", "2026-09-18T23:00:00.000Z");
    });
  });
});

