// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
}));

import { NextRequest } from "next/server";
import { GET as list, POST as create } from "../app/api/v1/promos/route";
import { GET as one, PATCH as patch, DELETE as del } from "../app/api/v1/promos/[id]/route";
import { PUT as activate } from "../app/api/v1/promos/[id]/activate/route";
import { POST as validate } from "../app/api/v1/promos/validate/route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown, url = "http://localhost:3000/api/v1/promos") => new NextRequest(url, { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const PROMO = { id: ID, code: "WELCOME10", discount_type: "percentage", discount_value: 10, min_order_amount: 0, max_uses: null, used_count: 0, starts_at: "2020-01-01T00:00:00Z", expires_at: null, is_active: true, created_at: "2026-01-01T00:00:00Z" };
const denied = () => mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  db.results.promos = { data: PROMO, error: null };
});

describe("admin promo routes need an admin", () => {
  it.each([
    ["list", () => list(req("GET"))], ["create", () => create(req("POST", { code: "ABC", discount_type: "percentage", discount_value: 5 }))],
    ["get", () => one(req("GET"), ctx())], ["patch", () => patch(req("PATCH", { is_active: false }), ctx())], ["delete", () => del(req("DELETE"), ctx())], ["activate", () => activate(req("PUT", {}), ctx())],
  ])("%s", async (_n, run) => {
    denied();
    expect((await run()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
});

describe("GET /promos", () => {
  it("lists codes with their usage", async () => {
    db.results.promos = { data: [PROMO], error: null };
    const { data } = await (await list(req("GET"))).json();
    expect(data[0]).toMatchObject({ code: "WELCOME10", used_count: 0 });
  });
});

describe("POST /promos", () => {
  it("creates a normalised code", async () => {
    const res = await create(req("POST", { code: "welcome10", discount_type: "percentage", discount_value: 10, used_count: 50 }));
    expect(res.status).toBe(201);
    const row = db.called("promos", "insert")!.args[0] as Record<string, unknown>;
    expect(row).toMatchObject({ code: "WELCOME10", discount_type: "percentage", discount_value: 10 });
    expect(row).not.toHaveProperty("used_count");
  });
  it("validates, and rejects bad JSON", async () => {
    expect((await create(req("POST", { code: "x" }))).status).toBe(400);
    expect((await create(req("POST", "{nope"))).status).toBe(400);
  });
  it("says so when the code exists already", async () => {
    db.results.promos = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint promos_code_key" } };
    const res = await create(req("POST", { code: "WELCOME10", discount_type: "percentage", discount_value: 10 }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CODE_TAKEN");
  });
  it("hides internal errors", async () => {
    db.results.promos = { data: null, error: { message: "relation secret_t missing" } };
    const res = await create(req("POST", { code: "WELCOME10", discount_type: "percentage", discount_value: 10 }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
});

describe("/promos/[id]", () => {
  it("GET returns it, 404s a missing or malformed id", async () => {
    expect((await one(req("GET"), ctx())).status).toBe(200);
    expect((await one(req("GET"), ctx("nope"))).status).toBe(404);
    db.results.promos = { data: null, error: null };
    expect((await one(req("GET"), ctx())).status).toBe(404);
  });
  it("PATCH updates only what's sent and never the use count", async () => {
    const res = await patch(req("PATCH", { discount_value: 15, used_count: 0, id: "x" }), ctx());
    expect(res.status).toBe(200);
    const row = db.called("promos", "update")!.args[0] as Record<string, unknown>;
    expect(row).toMatchObject({ discount_value: 15 });
    expect(row).not.toHaveProperty("used_count");
    expect(row).not.toHaveProperty("id");
  });
  it("PATCH won't rename a code that has been used", async () => {
    db.results.promos = { data: { ...PROMO, used_count: 3 }, error: null };
    const res = await patch(req("PATCH", { code: "NEWNAME" }), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CODE_IN_USE");
  });
  it("PATCH validates", async () => {
    expect((await patch(req("PATCH", { discount_value: 0 }), ctx())).status).toBe(400);
    expect((await patch(req("PATCH", {}), ctx())).status).toBe(400);
  });
  it("DELETE is refused once a code has been used, allowed before", async () => {
    db.results.promos = { data: { ...PROMO, used_count: 2 }, error: null };
    const res = await del(req("DELETE"), ctx());
    expect(res.status).toBe(409);
    db.reset();
    db.results.promos = { data: PROMO, error: null };
    expect((await del(req("DELETE"), ctx())).status).toBe(200);
    expect(db.called("promos", "delete")).toBeDefined();
  });
  it("activate flips the switch, or sets it", async () => {
    await activate(req("PUT", {}), ctx());
    expect(db.called("promos", "update")!.args[0]).toMatchObject({ is_active: false });
    db.reset();
    db.results.promos = { data: { ...PROMO, is_active: false }, error: null };
    await activate(req("PUT", { is_active: true }), ctx());
    expect(db.called("promos", "update")!.args[0]).toMatchObject({ is_active: true });
    expect((await activate(req("PUT", { is_active: "yes" }), ctx())).status).toBe(400);
  });
});

describe("POST /promos/validate (public)", () => {
  const check = (body: unknown) => validate(req("POST", body, "http://localhost:3000/api/v1/promos/validate"));
  it("gives the discount for a real code against the cart total, without needing a login", async () => {
    const res = await check({ code: "welcome10", cart_total: 3000000 });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ code: "WELCOME10", discount: 300000, total_after_discount: 2700000 });
    expect(mockAdmin).not.toHaveBeenCalled();
  });
  it("says the same thing for an unknown code and an unusable one", async () => {
    db.results.promos = { data: null, error: null };
    const unknown = await check({ code: "NOPE1", cart_total: 3000000 });
    db.results.promos = { data: { ...PROMO, is_active: false }, error: null };
    const inactive = await check({ code: "WELCOME10", cart_total: 3000000 });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual(await inactive.json());
  });
  it("says how much more to spend when the minimum isn't met", async () => {
    db.results.promos = { data: { ...PROMO, min_order_amount: 5000000 }, error: null };
    const res = await check({ code: "WELCOME10", cart_total: 3000000 });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("MIN_ORDER");
    expect(body.details.short_by).toBe(2000000);
  });
  it("validates the request, and never queries for a malformed code", async () => {
    for (const body of [{}, { code: "a b", cart_total: 1 }, { code: "GOOD1", cart_total: -1 }, { code: "GOOD1", cart_total: 1.5 }, { code: "GOOD1", cart_total: "9" }]) {
      expect((await check(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(db.touched).toHaveLength(0);
    expect((await check("{nope")).status).toBe(400);
  });
});
