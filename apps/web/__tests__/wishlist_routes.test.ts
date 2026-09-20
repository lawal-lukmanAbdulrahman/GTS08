// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
let authUser: { id: string } | null = null;
vi.mock("../app/api/v1/auth/utils", async (orig) => ({ ...(await orig<typeof import("../app/api/v1/auth/utils")>()), getAuthenticatedUser: async () => authUser }));

import { NextRequest } from "next/server";
import { GET as list, POST as add } from "../app/api/v1/wishlist/route";
import { DELETE as remove } from "../app/api/v1/wishlist/[productId]/route";
import { GET as check } from "../app/api/v1/wishlist/check/[productId]/route";

const P1 = "11111111-1111-4111-8111-111111111111";
const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/wishlist", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const ctx = (productId = P1) => ({ params: Promise.resolve({ productId }) });

beforeEach(() => {
  db.reset();
  authUser = { id: "u1" };
  db.results.wishlists = { data: [{ added_at: "2026-09-20T00:00:00Z", product: { id: P1, name: "Shirt", slug: "shirt", base_price: 1500000, status: "active", primary_image: null, variants: [{ is_active: true, inventory: { quantity: 3, reserved_quantity: 1 } }] } }], error: null };
  db.results.products = { data: { id: P1, status: "active" }, error: null };
});

describe("wishlist needs a signed-in user", () => {
  it.each([["list", () => list(req("GET"))], ["add", () => add(req("POST", { product_id: P1 }))], ["remove", () => remove(req("DELETE"), ctx())], ["check", () => check(req("GET"), ctx())]])("%s", async (_n, run) => {
    authUser = null;
    expect((await run()).status).toBe(401);
    expect(db.touched).toHaveLength(0);
  });
});

describe("GET /wishlist", () => {
  it("lists the user's saved products with whether each is in stock, only their own", async () => {
    const { data } = await (await list(req("GET"))).json();
    expect(data[0]).toMatchObject({ product_id: P1, name: "Shirt", slug: "shirt", price: 1500000, in_stock: true });
    expect(db.called("wishlists", "eq")!.args).toEqual(["user_id", "u1"]);
  });
  it("hides products that are no longer sold, and is never cached", async () => {
    db.results.wishlists = { data: [{ added_at: "x", product: { id: P1, name: "Old", slug: "old", base_price: 1, status: "archived", variants: [] } }], error: null };
    const res = await list(req("GET"));
    expect((await res.json()).data).toEqual([]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /wishlist", () => {
  it("saves a product, and saving it twice is fine", async () => {
    expect((await add(req("POST", { product_id: P1 }))).status).toBe(200);
    expect(db.called("wishlists", "upsert")!.args[0]).toMatchObject({ user_id: "u1", product_id: P1 });
    expect((await add(req("POST", { product_id: P1 }))).status).toBe(200);
  });
  it("only saves for the signed-in user, whatever user_id is sent", async () => {
    await add(req("POST", { product_id: P1, user_id: "someone-else" }));
    expect(db.called("wishlists", "upsert")!.args[0]).toMatchObject({ user_id: "u1" });
  });
  it("also takes a product slug, which is what the storefront knows a product by", async () => {
    db.results.products = { data: { id: P1, status: "active" }, error: null };
    expect((await add(req("POST", { product_slug: "oxford-shirt" }))).status).toBe(200);
    expect(db.called("products", "eq")!.args).toEqual(["slug", "oxford-shirt"]);
    expect(db.called("wishlists", "upsert")!.args[0]).toMatchObject({ product_id: P1 });
  });
  it("rejects a bad or unknown or unsold product", async () => {
    expect((await add(req("POST", { product_id: "nope" }))).status).toBe(400);
    expect((await add(req("POST", {}))).status).toBe(400);
    expect((await add(req("POST", "{nope"))).status).toBe(400);
    db.results.products = { data: null, error: null };
    expect((await add(req("POST", { product_id: P1 }))).status).toBe(404);
    db.results.products = { data: { id: P1, status: "draft" }, error: null };
    expect((await add(req("POST", { product_id: P1 }))).status).toBe(404);
  });
});

describe("DELETE /wishlist/[productId] and GET /wishlist/check/[productId]", () => {
  it("removes only the user's own entry", async () => {
    expect((await remove(req("DELETE"), ctx())).status).toBe(200);
    const eqs = db.calls.wishlists!.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toEqual([["user_id", "u1"], ["product_id", P1]]);
    expect((await remove(req("DELETE"), ctx("Bad Slug!"))).status).toBe(400);
  });
  it("removes by slug too", async () => {
    db.results.products = { data: { id: P1 }, error: null };
    expect((await remove(req("DELETE"), ctx("oxford-shirt"))).status).toBe(200);
    expect(db.calls.wishlists!.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual(["product_id", P1]);
  });
  it("says whether a product is saved", async () => {
    db.results.wishlists = { data: { id: "w1" }, error: null };
    expect((await (await check(req("GET"), ctx())).json()).data).toEqual({ is_wishlisted: true });
    db.results.wishlists = { data: null, error: null };
    expect((await (await check(req("GET"), ctx())).json()).data).toEqual({ is_wishlisted: false });
    expect((await check(req("GET"), ctx("nope"))).status).toBe(400);
  });
});
