// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
let authUser: { id: string } | null = null;
vi.mock("../app/api/v1/auth/utils", async (orig) => ({ ...(await orig<typeof import("../app/api/v1/auth/utils")>()), getAuthenticatedUser: async () => authUser }));

import { NextRequest } from "next/server";
import { GET as getCart, PUT as replaceCart, DELETE as clearCart } from "../app/api/v1/cart/[sessionId]/route";
import { POST as addItem } from "../app/api/v1/cart/[sessionId]/items/route";
import { PUT as setQty, DELETE as removeItem } from "../app/api/v1/cart/[sessionId]/items/[variantId]/route";
import { POST as validateCart } from "../app/api/v1/cart/[sessionId]/validate/route";
import { POST as merge } from "../app/api/v1/cart/merge/route";

const S = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/cart/x", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const session = (sessionId = S) => ({ params: Promise.resolve({ sessionId }) });
const item = (variantId = V1, sessionId = S) => ({ params: Promise.resolve({ sessionId, variantId }) });
const variant = (over: Record<string, unknown> = {}) => ({
  id: V1, size: "M", color: "Black", price_modifier: 50000, is_active: true,
  inventory: { quantity: 5, reserved_quantity: 1 },
  product: { id: "p1", name: "Oxford Shirt", slug: "oxford-shirt", base_price: 1500000, status: "active" }, ...over,
});

beforeEach(() => {
  db.reset();
  authUser = null;
  db.results.cart_sessions = { data: { session_id: S, user_id: null }, error: null };
  db.results.product_variants = { data: [variant()], error: null };
  db.results.products = { data: [{ slug: "oxford-shirt", status: "active", variants: [{ id: V1, size: "M", color: "Black", is_active: true }] }], error: null };
  db.results.cart_items = { data: [{ variant_id: V1, quantity: 2, variant: variant() }], error: null };
});

describe("session ids", () => {
  it("must be a random uuid, since the id is the only key to a cart", async () => {
    for (const bad of ["1", "cart-1", "../../etc", "x".repeat(300)]) {
      expect((await getCart(req("GET"), session(bad))).status, bad).toBe(400);
    }
    expect(db.touched).toHaveLength(0);
  });
});

describe("GET /cart/[sessionId]", () => {
  it("returns lines priced by the database, with stock, and the subtotal", async () => {
    const { data } = await (await getCart(req("GET"), session())).json();
    expect(data.lines[0]).toMatchObject({ variant_id: V1, name: "Oxford Shirt", size: "M", quantity: 2, unit_price: 1550000, line_total: 3100000, available: 4, valid: true });
    expect(data.subtotal).toBe(3100000);
    expect(data.all_valid).toBe(true);
  });
  it("marks a line invalid when it's short of stock or no longer sold", async () => {
    db.results.cart_items = { data: [{ variant_id: V1, quantity: 9, variant: variant() }, { variant_id: V2, quantity: 1, variant: variant({ id: V2, is_active: false }) }], error: null };
    const { data } = await (await getCart(req("GET"), session())).json();
    expect(data.lines.map((l: { valid: boolean }) => l.valid)).toEqual([false, false]);
    expect(data.all_valid).toBe(false);
  });
  it("is an empty cart for a session nobody has used, and is never cached", async () => {
    db.results.cart_items = { data: [], error: null };
    const res = await getCart(req("GET"), session());
    expect((await res.json()).data).toMatchObject({ lines: [], subtotal: 0 });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("hides internal errors", async () => {
    db.results.cart_items = { data: null, error: { message: "relation secret_t missing" } };
    const res = await getCart(req("GET"), session());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
});

describe("PUT /cart/[sessionId] (replace the cart with what the browser holds)", () => {
  it("swaps the cart's lines for the given ones, resolved and capped to stock", async () => {
    const res = await replaceCart(req("PUT", { items: [{ product_slug: "oxford-shirt", size: "M", color: "Black", quantity: 9 }] }), session());
    expect(res.status).toBe(200);
    expect(db.called("cart_items", "delete")).toBeDefined();
    expect(db.called("cart_items", "upsert")!.args[0]).toEqual([{ session_id: S, variant_id: V1, quantity: 4 }]); // 4 available
  });
  it("quietly drops lines it can't match and says how many", async () => {
    db.results.products = { data: [], error: null };
    const res = await replaceCart(req("PUT", { items: [{ product_slug: "ghost", quantity: 1 }] }), session());
    expect((await res.json()).data.dropped).toBe(1);
    expect(db.called("cart_items", "upsert")).toBeUndefined();
  });
  it("an empty list empties the cart", async () => {
    expect((await replaceCart(req("PUT", { items: [] }), session())).status).toBe(200);
    expect(db.called("cart_items", "delete")).toBeDefined();
  });
  it("validates the session and the list", async () => {
    expect((await replaceCart(req("PUT", { items: [] }), session("nope"))).status).toBe(400);
    expect((await replaceCart(req("PUT", {}), session())).status).toBe(400);
    expect((await replaceCart(req("PUT", { items: Array.from({ length: 51 }, () => ({ product_slug: "x", quantity: 1 })) }), session())).status).toBe(400);
    expect((await replaceCart(req("PUT", "{nope"), session())).status).toBe(400);
  });
});

describe("POST /cart/[sessionId]/items", () => {
  it("adds a variant, checking stock, and starts the cart if it's new", async () => {
    db.results.cart_items = { data: null, error: null };
    const res = await addItem(req("POST", { variant_id: V1, quantity: 2 }), session());
    expect(res.status).toBe(200);
    expect(db.touched).toContain("cart_sessions");
    expect(db.called("cart_items", "upsert")!.args[0]).toMatchObject({ session_id: S, variant_id: V1, quantity: 2 });
  });
  it("adds to a line already in the cart", async () => {
    db.results.cart_items = { data: { quantity: 1 }, error: null };
    await addItem(req("POST", { variant_id: V1, quantity: 2 }), session());
    expect(db.called("cart_items", "upsert")!.args[0]).toMatchObject({ quantity: 3 });
  });
  it("accepts a product slug, size and colour like checkout does", async () => {
    db.results.cart_items = { data: null, error: null };
    expect((await addItem(req("POST", { product_slug: "oxford-shirt", size: "m", quantity: 1 }), session())).status).toBe(200);
  });
  it("refuses more than is available, saying how many are", async () => {
    db.results.cart_items = { data: { quantity: 3 }, error: null };
    const res = await addItem(req("POST", { variant_id: V1, quantity: 2 }), session());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INSUFFICIENT_STOCK");
    expect(body.details.available).toBe(4);
    expect(db.called("cart_items", "upsert")).toBeUndefined();
  });
  it("refuses a product that isn't sold, and bad input", async () => {
    db.results.product_variants = { data: [variant({ is_active: false })], error: null };
    expect((await addItem(req("POST", { variant_id: V1, quantity: 1 }), session())).status).toBe(400);
    for (const body of [{}, { variant_id: "x", quantity: 1 }, { variant_id: V1, quantity: 0 }, { variant_id: V1, quantity: 1.5 }, { variant_id: V1, quantity: "2" }]) {
      expect((await addItem(req("POST", body), session())).status, JSON.stringify(body)).toBe(400);
    }
    expect((await addItem(req("POST", "{nope"), session())).status).toBe(400);
  });
  it("caps the number of different products in one cart", async () => {
    db.results.cart_items = (calls) => ({ data: calls.some((c) => c.method === "maybeSingle" || c.method === "single") ? null : Array.from({ length: 50 }, (_, i) => ({ variant_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` })), error: null });
    expect((await addItem(req("POST", { variant_id: V1, quantity: 1 }), session())).status).toBe(409);
  });
});

describe("PUT and DELETE /cart/[sessionId]/items/[variantId]", () => {
  it("sets a quantity within stock", async () => {
    expect((await setQty(req("PUT", { quantity: 3 }), item())).status).toBe(200);
    expect(db.called("cart_items", "update")!.args[0]).toMatchObject({ quantity: 3 });
  });
  it("refuses a quantity over stock or under one", async () => {
    expect((await setQty(req("PUT", { quantity: 9 }), item())).status).toBe(409);
    for (const q of [0, -1, 1.2, "3"]) expect((await setQty(req("PUT", { quantity: q }), item())).status).toBe(400);
  });
  it("removes a line, and clears the whole cart", async () => {
    expect((await removeItem(req("DELETE"), item())).status).toBe(200);
    expect(db.called("cart_items", "delete")).toBeDefined();
    db.reset();
    expect((await clearCart(req("DELETE"), session())).status).toBe(200);
    expect(db.called("cart_items", "delete")).toBeDefined();
  });
  it("rejects a malformed variant id", async () => {
    expect((await removeItem(req("DELETE"), item("nope"))).status).toBe(400);
  });
});

describe("POST /cart/[sessionId]/validate", () => {
  it("says, per line, what was asked for, what's available, and whether it's fine", async () => {
    db.results.cart_items = { data: [{ variant_id: V1, quantity: 9, variant: variant() }], error: null };
    const { data } = await (await validateCart(req("POST"), session())).json();
    expect(data.items[0]).toMatchObject({ variant_id: V1, requested: 9, available: 4, valid: false });
    expect(data.valid).toBe(false);
  });
});

describe("POST /cart/merge (after signing in)", () => {
  it("needs a signed-in user", async () => {
    expect((await merge(req("POST", { session_id: S }))).status).toBe(401);
    expect(db.touched).toHaveLength(0);
  });
  it("moves the anonymous cart into the account's cart, respecting stock", async () => {
    authUser = { id: "u1" };
    db.results.cart_sessions = { data: { session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: "u1" }, error: null };
    db.results.cart_items = { data: [{ variant_id: V1, quantity: 3, variant: variant() }], error: null };
    const res = await merge(req("POST", { session_id: S }));
    expect(res.status).toBe(200);
    expect(db.touched).toContain("cart_items");
    const { data } = await res.json();
    expect(data.session_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });
  it("validates the session id", async () => {
    authUser = { id: "u1" };
    expect((await merge(req("POST", { session_id: "nope" }))).status).toBe(400);
    expect((await merge(req("POST", {}))).status).toBe(400);
  });
});
