import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({
  createServiceClient: () => db.client,
  getRequestDataMode: () => Promise.resolve("live"),
}));

let staffResult: any = {
  ok: true,
  user: { id: "user-admin-1", email: "admin@gts.ng" },
  permissions: { can_manage_products: true },
};

vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: vi.fn(async () => staffResult),
}));

vi.mock("../app/api/v1/_lib/storefront-cache", () => ({
  invalidateStorefrontCaches: vi.fn(),
}));

import { NextRequest } from "next/server";
import { DELETE as deleteProductsRoute } from "../app/api/v1/products/route";
import { DELETE as deleteProductSlugRoute } from "../app/api/v1/products/[slug]/route";

describe("Product deletion API endpoints", () => {
  beforeEach(() => {
    db.reset();
    staffResult = {
      ok: true,
      user: { id: "user-admin-1", email: "admin@gts.ng" },
      permissions: { can_manage_products: true },
    };
  });

  describe("DELETE /api/v1/products", () => {
    it("rejects deletion without can_manage_products permission", async () => {
      staffResult = {
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      };

      const req = new NextRequest("http://localhost:3000/api/v1/products?id=prod-1", {
        method: "DELETE",
      });
      const res = await deleteProductsRoute(req);
      expect(res.status).toBe(403);
    });

    it("rejects request if no product ID is provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products", {
        method: "DELETE",
      });
      const res = await deleteProductsRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Product ID is required/i);
    });

    it("deletes a single product by query param ?id=...", async () => {
      const prodId = "11111111-1111-4111-8111-111111111111";
      db.results.product_variants = {
        data: [{ id: "var-1" }, { id: "var-2" }],
        error: null,
      };
      db.results.products = { data: null, error: null };

      const req = new NextRequest(`http://localhost:3000/api/v1/products?id=${prodId}`, {
        method: "DELETE",
      });
      const res = await deleteProductsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted_ids).toEqual([prodId]);

      // Verify that dependent tables were cleaned up
      expect(db.touched).toContain("product_variants");
      expect(db.touched).toContain("stock_movements");
      expect(db.touched).toContain("cart_items");
      expect(db.touched).toContain("inventory");
      expect(db.touched).toContain("product_images");
      expect(db.touched).toContain("products");
      expect(db.touched).toContain("activity_logs");
    });

    it("deletes multiple products by query param ?ids=id1,id2", async () => {
      const prod1 = "11111111-1111-4111-8111-111111111111";
      const prod2 = "22222222-2222-4222-8222-222222222222";
      db.results.product_variants = { data: [{ id: "v1" }], error: null };
      db.results.products = { data: null, error: null };

      const req = new NextRequest(`http://localhost:3000/api/v1/products?ids=${prod1},${prod2}`, {
        method: "DELETE",
      });
      const res = await deleteProductsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted_ids).toEqual([prod1, prod2]);
    });

    it("deletes products specified in JSON body", async () => {
      const prodId = "33333333-3333-4333-8333-333333333333";
      db.results.product_variants = { data: [], error: null };
      db.results.products = { data: null, error: null };

      const req = new NextRequest("http://localhost:3000/api/v1/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prodId }),
      });
      const res = await deleteProductsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.deleted_ids).toEqual([prodId]);
    });
  });

  describe("DELETE /api/v1/products/[slug]", () => {
    it("deletes a product by slug", async () => {
      const prodId = "44444444-4444-4444-8444-444444444444";
      db.results.products = { data: { id: prodId }, error: null };
      db.results.product_variants = { data: [{ id: "v-slug-1" }], error: null };

      const req = new NextRequest("http://localhost:3000/api/v1/products/cool-shirt", {
        method: "DELETE",
      });
      const res = await deleteProductSlugRoute(req, {
        params: Promise.resolve({ slug: "cool-shirt" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.id).toBe(prodId);
    });

    it("returns 404 if product not found", async () => {
      db.results.products = { data: null, error: null };

      const req = new NextRequest("http://localhost:3000/api/v1/products/non-existent-product", {
        method: "DELETE",
      });
      const res = await deleteProductSlugRoute(req, {
        params: Promise.resolve({ slug: "non-existent-product" }),
      });
      expect(res.status).toBe(404);
    });
  });
});
