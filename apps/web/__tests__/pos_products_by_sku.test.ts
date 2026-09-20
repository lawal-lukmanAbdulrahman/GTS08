import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

let variantResult: { data: unknown; error: unknown } = { data: null, error: null };
function makeQueryStub() {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    maybeSingle: vi.fn(() => Promise.resolve(variantResult)),
  };
  return stub;
}
const mockFrom = vi.fn((_table: string) => makeQueryStub());
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => mockFrom(table) }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/products/[sku]/route";

function ctx(sku: string) {
  return { params: Promise.resolve({ sku }) };
}

describe("GET /api/v1/pos/products/:sku (barcode scan, spec Part 7)", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
  });

  it("returns 404 with a clear message when no variant matches the SKU", async () => {
    variantResult = { data: null, error: null };
    const req = new NextRequest("http://localhost:3000/api/v1/pos/products/UNKNOWN-SKU");
    const res = await GET(req, ctx("UNKNOWN-SKU"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/UNKNOWN-SKU/);
  });

  it("returns the matching variant pre-identified for the Variant Selector Modal", async () => {
    variantResult = {
      data: {
        id: "v1",
        size: "L",
        color: "Black",
        color_hex: "#000",
        sku: "GTS-SHIRT-L-BLK",
        price_modifier: 0,
        inventory: { quantity: 4, reserved_quantity: 1, low_stock_threshold: 5 },
        product: { id: "p1", name: "GTS Oxford Shirt", slug: "gts-oxford-shirt", base_price: 1500000 },
      },
      error: null,
    };
    const req = new NextRequest("http://localhost:3000/api/v1/pos/products/GTS-SHIRT-L-BLK");
    const res = await GET(req, ctx("GTS-SHIRT-L-BLK"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.variant.id).toBe("v1");
    expect(body.data.variant.available).toBe(3);
    expect(body.data.product.name).toBe("GTS Oxford Shirt");
  });

  it.each(["x') or 1=1--", "a;b", "", "x".repeat(200), "../etc/passwd"])(
    "answers 404 for a value that can't be a SKU (%s) without querying the database",
    async (sku) => {
      variantResult = { data: null, error: { message: "<!DOCTYPE html>blocked" } };
      const res = await GET(new NextRequest("http://localhost:3000/api/v1/pos/products/x"), ctx(sku));
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("SKU_NOT_FOUND");
    }
  );
});
