import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

/** A Supabase query-builder stub: every filter method returns itself, and
 * awaiting it resolves to whatever `result` is set to. */
function makeQueryStub(result: { data: unknown; count?: number; error: unknown }) {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    or: vi.fn(() => stub),
    order: vi.fn(() => stub),
    range: vi.fn(() => stub),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return stub;
}

let queryResult: { data: unknown; count?: number; error: unknown } = { data: [], count: 0, error: null };
const mockFrom = vi.fn(() => makeQueryStub(queryResult));
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/products/search/route";

function makeRequest(query: string) {
  return new NextRequest(`http://localhost:3000/api/v1/pos/products/search${query}`);
}

describe("GET /api/v1/pos/products/search", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockFrom.mockClear();
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });

    const res = await GET(makeRequest("?q=shirt"));
    expect(res.status).toBe(403);
  });

  it("returns an empty result set for a blank query without hitting the database", async () => {
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });

    const res = await GET(makeRequest(""));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("maps product rows with stock status and variants for a matching query", async () => {
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
    queryResult = {
      data: [
        {
          id: "p1",
          name: "GTS Oxford Shirt",
          slug: "gts-oxford-shirt",
          base_price: 1500000,
          category: { id: "c1", name: "Shirts", slug: "shirts" },
          images: [{ cloudinary_public_id: "img1", alt_text: "Shirt", is_primary: true }],
          variants: [
            {
              id: "v1",
              size: "M",
              color: "Black",
              color_hex: "#000000",
              sku: "GTS-SHIRT-M-BLK",
              price_modifier: 0,
              is_active: true,
              inventory: { quantity: 10, reserved_quantity: 2, low_stock_threshold: 5 },
            },
          ],
        },
      ],
      count: 1,
      error: null,
    };

    const res = await GET(makeRequest("?q=oxford"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "p1",
      name: "GTS Oxford Shirt",
      base_price: 1500000,
      stock_status: "in_stock",
    });
    expect(body.data[0].variants[0]).toMatchObject({
      id: "v1",
      size: "M",
      color: "Black",
      available: 8,
    });
  });

  it("returns a 500 with a clear error shape on a database error", async () => {
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
    queryResult = { data: null, count: 0, error: { message: "connection lost" } };

    const res = await GET(makeRequest("?q=oxford"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe("DATABASE_ERROR");
  });
});
