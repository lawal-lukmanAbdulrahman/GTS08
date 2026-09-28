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
import { GET } from "../app/api/v1/users/route";

const call = (qs = "") => GET(new NextRequest(`http://localhost:3000/api/v1/users${qs}`));
beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  db.results.users = { data: [{ id: "u1", email: "a@b.co", full_name: "Ada", phone: null, role: "cashier", is_blocked: false, created_at: "x" }], error: null, count: 41 };
});

describe("GET /users (admin)", () => {
  it("is for admins only", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
  it("lists people with paging, and returns no password or token fields", async () => {
    const res = await call("?page=2&limit=20");
    const body = await res.json();
    expect(body.meta).toEqual({ total: 41, page: 2, limit: 20, pages: 3 });
    expect(db.called("users", "range")!.args).toEqual([20, 39]);
    expect(String(db.called("users", "select")!.args[0])).not.toMatch(/password|token|pin|secret/i);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("filters by role and blocked state", async () => {
    await call("?role=cashier&is_blocked=false");
    const eqs = db.calls.users!.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toEqual([["is_demo", false], ["role", "cashier"], ["is_blocked", false]]);
  });
  it("shows only accounts on the caller's side: a real admin never sees the demo login, the demo login never sees real staff", async () => {
    await call();
    expect(db.calls.users!.find((c) => c.method === "eq")!.args).toEqual(["is_demo", false]);
    db.reset();
    db.results.users = { data: [], error: null, count: 0 };
    mockAdmin.mockResolvedValue({ ok: true, user: { id: "demo" }, isAdmin: true, isDemo: true });
    await call();
    expect(db.calls.users!.find((c) => c.method === "eq")!.args).toEqual(["is_demo", true]);
  });
  it("leaves out staff who were removed", async () => {
    await call();
    expect(db.calls.users!.some((c) => c.method === "is" && c.args[0] === "removed_at" && c.args[1] === null)).toBe(true);
  });
  it("searches name and email safely", async () => {
    await call("?q=ada%25,role.eq.admin");
    const or = db.called("users", "or")!.args[0] as string;
    // Only the one comma we wrote may remain, so the search text can't add a filter of its own.
    expect((or.match(/,/g) ?? []).length).toBe(1);
    expect(or).not.toMatch(/[()]/);
  });
  it("rejects unknown filters and bad paging", async () => {
    for (const qs of ["?role=root", "?is_blocked=maybe", "?page=0", "?limit=101", "?limit=x"]) expect((await call(qs)).status, qs).toBe(400);
  });
});
