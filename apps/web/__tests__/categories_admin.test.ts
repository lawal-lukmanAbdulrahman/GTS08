// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockPerm = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockPerm(...a),
}));

import { NextRequest } from "next/server";
import { POST as createCategory } from "../app/api/v1/categories/route";
import { GET, PATCH, DELETE } from "../app/api/v1/categories/[id]/route";
import { PUT as REORDER } from "../app/api/v1/categories/reorder/route";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/categories/x", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const inserted = (t: string, m = "update") => db.calls[t]?.find((c) => c.method === m)?.args[0] as Record<string, unknown> | undefined;

beforeEach(() => {
  db.reset();
  mockPerm.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  db.results.categories = { data: { id: ID, name: "Shirts", slug: "shirts", parent_id: null, is_active: true }, error: null };
});

describe("GET /categories/[id]", () => {
  it("is public and finds a category by id or by slug", async () => {
    expect((await GET(req("GET"), ctx(ID))).status).toBe(200);
    expect((await GET(req("GET"), ctx("shirts"))).status).toBe(200);
    expect(mockPerm).not.toHaveBeenCalled();
  });
  it("hides inactive categories from the public", async () => {
    db.results.categories = { data: { id: ID, name: "Old", slug: "old", is_active: false }, error: null };
    expect((await GET(req("GET"), ctx(ID))).status).toBe(404);
  });
  it("404s an unknown one and rejects a malformed slug without querying", async () => {
    db.results.categories = { data: null, error: null };
    expect((await GET(req("GET"), ctx("ghost"))).status).toBe(404);
    db.reset();
    expect((await GET(req("GET"), ctx("bad slug;--"))).status).toBe(404);
    expect(db.touched).toHaveLength(0);
  });
});

describe("PATCH /categories/[id] (needs can_manage_products)", () => {
  it("is refused for anyone without the grant", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no", code: "FORBIDDEN" }, { status: 403 }) });
    expect((await PATCH(req("PATCH", { name: "X" }), ctx(ID))).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
  it("updates only the fields sent, trimmed", async () => {
    const res = await PATCH(req("PATCH", { name: "  Formal Shirts ", sort_order: 3, is_active: false, id: "x", created_at: "x" }), ctx(ID));
    expect(res.status).toBe(200);
    expect(inserted("categories")).toMatchObject({ name: "Formal Shirts", sort_order: 3, is_active: false });
    expect(inserted("categories")).not.toHaveProperty("id");
    expect(inserted("categories")).not.toHaveProperty("created_at");
  });
  it("validates: bad name, slug, sort order, parent", async () => {
    for (const body of [{ name: "" }, { name: "x".repeat(101) }, { slug: "Bad Slug" }, { sort_order: -1 }, { sort_order: 1.5 }, { parent_id: "nope" }, { is_active: "yes" }, {}]) {
      const res = await PATCH(req("PATCH", body), ctx(ID));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
  it("won't make a category its own parent", async () => {
    const res = await PATCH(req("PATCH", { parent_id: ID }), ctx(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).details.parent_id).toMatch(/own parent/i);
  });
  it("404s a missing category, 409s a duplicate slug, hides DB errors", async () => {
    db.results.categories = { data: null, error: null };
    expect((await PATCH(req("PATCH", { name: "X" }), ctx(ID))).status).toBe(404);
    db.results.categories = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint categories_slug_key" } };
    expect((await PATCH(req("PATCH", { slug: "shirts" }), ctx(ID))).status).toBe(409);
    db.results.categories = { data: null, error: { message: "relation secret missing" } };
    const res = await PATCH(req("PATCH", { name: "X" }), ctx(ID));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret/);
  });
  it("rejects bad JSON and a non-uuid id", async () => {
    expect((await PATCH(req("PATCH", "{nope"), ctx(ID))).status).toBe(400);
    expect((await PATCH(req("PATCH", { name: "X" }), ctx("not-a-uuid"))).status).toBe(404);
  });
});

describe("DELETE /categories/[id]", () => {
  it("needs can_manage_products", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await DELETE(req("DELETE"), ctx(ID))).status).toBe(403);
  });
  it("is blocked while any product is in the category", async () => {
    db.results.products = { data: [{ id: "p1" }], error: null };
    const res = await DELETE(req("DELETE"), ctx(ID));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CATEGORY_IN_USE");
    expect(db.calls.categories?.some((c) => c.method === "delete")).toBeFalsy();
  });
  it("deletes an empty category", async () => {
    db.results.products = { data: [], error: null };
    const res = await DELETE(req("DELETE"), ctx(ID));
    expect(res.status).toBe(200);
    expect(db.calls.categories?.some((c) => c.method === "delete")).toBe(true);
  });
});

describe("PUT /categories/reorder", () => {
  it("needs can_manage_products and a list of {id, sort_order}", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await REORDER(req("PUT", [{ id: ID, sort_order: 0 }]))).status).toBe(403);
    mockPerm.mockResolvedValue({ ok: true, user: { id: "a" }, isAdmin: true });
    for (const body of [{}, [], [{ id: "x", sort_order: 1 }], [{ id: ID, sort_order: -1 }], [{ id: ID, sort_order: 1 }, { id: ID, sort_order: 2 }], Array.from({ length: 201 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, sort_order: i }))]) {
      expect((await REORDER(req("PUT", body))).status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });
  it("updates each category's order", async () => {
    const res = await REORDER(req("PUT", [{ id: ID, sort_order: 1 }, { id: ID2, sort_order: 0 }]));
    expect(res.status).toBe(200);
    expect(db.touched.filter((t) => t === "categories")).toHaveLength(2);
  });
});

describe("POST /categories", () => {
  const post = (body: unknown) => createCategory(req("POST", body));
  it("needs can_manage_products", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await post({ name: "Shirts" })).status).toBe(403);
  });
  it("creates a category with a slug made from its name", async () => {
    const res = await post({ name: "  Formal   Shirts ", sort_order: 2 });
    expect(res.status).toBe(201);
    expect(db.called("categories", "insert")!.args[0]).toMatchObject({ name: "Formal Shirts", slug: "formal-shirts", sort_order: 2 });
  });
  it("validates", async () => {
    for (const body of [{}, { name: "" }, { name: "x".repeat(101) }, { name: "Ok", slug: "Bad Slug" }, { name: "Ok", sort_order: -1 }, { name: "Ok", parent_id: "nope" }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await post("{nope")).status).toBe(400);
  });
  it("tells the admin when it fails, instead of pretending it worked", async () => {
    db.results.categories = { data: null, error: { message: "relation secret_t missing" } };
    const res = await post({ name: "Shirts" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
  it("says so when the name or slug is taken", async () => {
    db.results.categories = { data: null, error: { code: "23505", message: "duplicate key" } };
    expect((await post({ name: "Shirts" })).status).toBe(409);
  });
});
