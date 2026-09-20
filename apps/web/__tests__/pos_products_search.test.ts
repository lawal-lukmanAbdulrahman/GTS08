import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

type Result = { data: unknown; count?: number; error: unknown };
let results: Record<string, Result> = {};
const calls: Record<string, Array<{ method: string; args: unknown[] }>> = {};

function makeStub(table: string) {
  const log: Array<{ method: string; args: unknown[] }> = [];
  calls[table] = log;
  const stub: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          const r = results[table] ?? { data: [], count: 0, error: null };
          return (resolve: (v: Result) => void) => resolve(r);
        }
        return (...args: unknown[]) => {
          log.push({ method: prop, args });
          return stub;
        };
      },
    }
  );
  return stub;
}
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => makeStub(table) }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/pos/products/search/route";

const req = (query: string) => new NextRequest(`http://localhost:3000/api/v1/pos/products/search${query}`);
const call = (table: string, method: string) => calls[table]?.find((c) => c.method === method);

const PRODUCT_ROW = {
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
};

describe("GET /api/v1/pos/products/search", () => {
  beforeEach(() => {
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
    results = { products: { data: [PRODUCT_ROW], count: 1, error: null } };
    Object.keys(calls).forEach((k) => delete calls[k]);
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    expect((await GET(req("?q=shirt"))).status).toBe(403);
  });

  describe("with no search text (the POS lists products on load)", () => {
    it("lists active products, best sellers first, without any text filter", async () => {
      const res = await GET(req(""));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(call("products", "eq")?.args).toEqual(["status", "active"]);
      expect(call("products", "or")).toBeUndefined();
      expect(call("products", "order")?.args).toEqual(["total_sold", { ascending: false }]);
    });

    it("pages through the catalogue", async () => {
      await GET(req("?page=3&limit=20"));
      expect(call("products", "range")?.args).toEqual([40, 59]);
    });

    it("caps the page size", async () => {
      await GET(req("?limit=5000"));
      expect(call("products", "range")?.args).toEqual([0, 59]);
    });

    it("reports paging info", async () => {
      results.products = { data: [PRODUCT_ROW], count: 95, error: null };
      const { meta } = await (await GET(req("?limit=30"))).json();
      expect(meta).toMatchObject({ total: 95, page: 1, limit: 30, pages: 4 });
    });
  });

  describe("with search text", () => {
    it("matches on name or SKU", async () => {
      await GET(req("?q=oxford"));
      expect(call("products", "or")?.args[0]).toBe("name.ilike.%oxford%,sku.ilike.%oxford%");
    });

    it("cannot be used to inject extra PostgREST filters", async () => {
      await GET(req("?q=" + encodeURIComponent("x%,status.eq.draft),(name.ilike.%")));
      const filter = call("products", "or")!.args[0] as string;
      // Exactly the two intended clauses, each a plain ilike on name / sku. The
      // attacker's words survive only as harmless text inside the pattern.
      const clauses = filter.split(",");
      expect(clauses).toHaveLength(2);
      expect(clauses[0]).toMatch(/^name\.ilike\.%[^%]*%$/);
      expect(clauses[1]).toMatch(/^sku\.ilike\.%[^%]*%$/);
      expect(filter).not.toMatch(/[()]/);
    });

    it("treats a query that is only punctuation as no search at all", async () => {
      await GET(req("?q=" + encodeURIComponent(",()%")));
      expect(call("products", "or")).toBeUndefined();
    });
  });

  it("maps rows with stock status and variant availability", async () => {
    const body = await (await GET(req("?q=oxford"))).json();
    expect(body.data[0]).toMatchObject({
      id: "p1",
      name: "GTS Oxford Shirt",
      base_price: 1500000,
      stock_status: "in_stock",
    });
    expect(body.data[0].variants[0]).toMatchObject({ id: "v1", size: "M", color: "Black", available: 8 });
  });

  describe("category filter", () => {
    it("includes the category's sub-categories so a top-level tab shows everything under it", async () => {
      results.categories = {
        data: [
          { id: "appl", parent_id: null, slug: "appliances" },
          { id: "wash", parent_id: "appl", slug: "washing-machines" },
          { id: "fridge", parent_id: "appl", slug: "fridges" },
        ],
        error: null,
      };
      await GET(req("?category=appliances"));
      const ids = call("products", "in")?.args;
      expect(ids?.[0]).toBe("category_id");
      expect([...(ids?.[1] as string[])].sort()).toEqual(["appl", "fridge", "wash"]);
    });

    it("returns an empty list for a category that doesn't exist", async () => {
      results.categories = { data: [], error: null };
      const body = await (await GET(req("?category=nope"))).json();
      expect(body.data).toEqual([]);
      expect(calls.products).toBeUndefined();
    });

    it("'all' applies no category filter", async () => {
      await GET(req("?category=all"));
      expect(call("products", "in")).toBeUndefined();
      expect(calls.categories).toBeUndefined();
    });
  });

  it("returns a 500 with a clear error shape on a database error", async () => {
    results.products = { data: null, count: 0, error: { message: "connection lost" } };
    const res = await GET(req("?q=oxford"));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("DATABASE_ERROR");
  });

  describe("QA regressions", () => {
    it("a page past the end is an empty page, not a 500", async () => {
      results.products = { data: null, count: 0, error: { code: "PGRST103", message: "Requested range not satisfiable" } };
      const res = await GET(req("?page=9999"));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ data: [], meta: { page: 9999 } });
    });

    it("statement separators and comment markers never reach the database query", async () => {
      await GET(req("?q=" + encodeURIComponent("';drop table products;--")));
      const filter = call("products", "or")!.args[0] as string;
      expect(filter).not.toMatch(/;|--/);
    });

    it("never echoes an upstream HTML error page to the caller", async () => {
      results.products = { data: null, count: 0, error: { message: "<!DOCTYPE html><html>blocked</html>" } };
      const res = await GET(req("?q=oxford"));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).not.toContain("<");
      expect(body.code).toBe("DATABASE_ERROR");
    });
  });
});
