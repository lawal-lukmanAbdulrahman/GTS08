// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));

const mockUser = vi.fn();
vi.mock("../app/api/v1/auth/utils", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/auth/utils")>()),
  getAuthenticatedUser: (...a: unknown[]) => mockUser(...a),
}));
const mockPermission = vi.fn();
const mockAdmin = vi.fn();
const mockOptional = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockPermission(...a),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
  optionalStaff: (...a: unknown[]) => mockOptional(...a),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST as createCategory } from "../app/api/v1/categories/route";
import { POST as createBrand } from "../app/api/v1/brands/route";
import { GET as listDrafts } from "../app/api/v1/products/drafts/route";
import { GET as listOrders } from "../app/api/v1/orders/route";
import { POST as createBroadcast, DELETE as deleteBroadcast } from "../app/api/v1/broadcast/route";
import { PUT as setOrderStatus } from "../app/api/v1/orders/[id]/status/route";
import { GET as listInquiries } from "../app/api/v1/inquiries/route";

const deny = (status: number) => ({ ok: false, response: NextResponse.json({ code: "X" }, { status }) });
const req = (method = "GET", url = "http://localhost:3000/api/v1/x", body?: unknown) =>
  new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

describe("write and staff-only routes are gated by the right grant", () => {
  beforeEach(() => {
    db.reset();
    mockPermission.mockReset().mockResolvedValue(deny(403));
    mockAdmin.mockReset().mockResolvedValue(deny(403));
    mockOptional.mockReset().mockResolvedValue(null);
    mockUser.mockReset().mockResolvedValue(null);
  });

  it.each([
    ["POST /categories", () => createCategory(req("POST", undefined, { name: "x" })), "can_manage_products"],
    ["POST /brands", () => createBrand(req("POST", undefined, { name: "x" })), "can_manage_products"],
    ["GET /products/drafts", () => listDrafts(req()), "can_manage_products"],
    ["PUT /orders/[id]/status", () => setOrderStatus(req("PUT", undefined, { status: "processing" }), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) }), "can_view_all_orders"],
    ["GET /inquiries?all=true", () => listInquiries(req("GET", "http://localhost:3000/api/v1/inquiries?all=true")), "can_handle_tickets"],
  ])("%s needs %s and touches nothing without it", async (_n, call, grant) => {
    const res = await (call as () => Promise<Response>)();
    expect(res.status).toBe(403);
    expect(mockPermission).toHaveBeenCalledWith(expect.anything(), grant);
    expect(db.touched).toHaveLength(0);
  });

  it.each([
    ["POST /broadcast", () => createBroadcast(req("POST", undefined, { title: "x" }))],
    ["DELETE /broadcast", () => deleteBroadcast(req("DELETE", "http://localhost:3000/api/v1/broadcast?id=1"))],
  ])("%s is admin-only", async (_n, call) => {
    const res = await (call as () => Promise<Response>)();
    expect(res.status).toBe(403);
    expect(mockAdmin).toHaveBeenCalled();
    expect(db.touched).toHaveLength(0);
  });

  describe("no development-mode bypass", () => {
    const original = process.env.NODE_ENV;
    afterEach(() => ((process.env as Record<string, string | undefined>).NODE_ENV = original));

    it("an anonymous broadcast write is still refused when NODE_ENV is 'development'", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      mockAdmin.mockResolvedValue(deny(401));
      const res = await createBroadcast(req("POST", undefined, { title: "x" }));
      expect(res.status).toBe(401);
    });
  });
});

describe("GET /orders shows each person their own orders unless they hold the order grant", () => {
  beforeEach(() => {
    db.reset();
    mockUser.mockReset().mockResolvedValue({ id: "u1", email: "a@x.com" });
    mockOptional.mockReset();
    db.results.customers = { data: [], error: null };
    db.results.orders = { data: [], error: null, count: 0 };
    db.results.users = { data: { role: "cashier" }, error: null };
  });

  it("401 when not signed in", async () => {
    mockUser.mockResolvedValue(null);
    expect((await listOrders(req())).status).toBe(401);
  });

  it("a cashier without the grant gets the customer view (their own orders), not everyone's", async () => {
    mockOptional.mockResolvedValue({ isAdmin: false, permissions: { can_process_pos: true, can_view_all_orders: false } });
    await listOrders(req());
    expect(db.touched).toContain("customers"); // looked up their own customer records
  });

  it("staff with the grant see all orders (no per-customer lookup)", async () => {
    mockOptional.mockResolvedValue({ isAdmin: false, permissions: { can_view_all_orders: true } });
    await listOrders(req());
    expect(db.touched).not.toContain("customers");
  });

  it("an admin sees all orders", async () => {
    mockOptional.mockResolvedValue({ isAdmin: true, permissions: { can_view_all_orders: true } });
    await listOrders(req());
    expect(db.touched).not.toContain("customers");
  });
});
