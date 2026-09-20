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
import { GET as list } from "../app/api/v1/notifications/route";
import { GET as unread } from "../app/api/v1/notifications/unread-count/route";
import { PUT as markOne } from "../app/api/v1/notifications/[id]/read/route";
import { PUT as markAll } from "../app/api/v1/notifications/read-all/route";
import { createAdminNotification } from "../app/api/v1/_lib/notify-admin";

const ID = "11111111-1111-4111-8111-111111111111";
const req = (method: string, qs = "") => new NextRequest(`http://localhost:3000/api/v1/notifications${qs}`, { method });
const ROW = { id: ID, type: "new_order", title: "New order", message: "GTS-1 was paid", link: "/admin/orders", is_read: false, created_at: "2026-09-20T10:00:00Z" };

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  db.results.admin_notifications = { data: [ROW], error: null, count: 3 };
});

describe("notification routes are for admins", () => {
  it.each([["list", () => list(req("GET"))], ["unread-count", () => unread(req("GET"))], ["read one", () => markOne(req("PUT"), { params: Promise.resolve({ id: ID }) })], ["read all", () => markAll(req("PUT"))]])("%s", async (_n, run) => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await run()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
});

describe("GET /notifications", () => {
  it("lists the newest, optionally only unread, with a limit", async () => {
    const res = await list(req("GET", "?unread=true&limit=5"));
    expect((await res.json()).data).toEqual([ROW]);
    expect(db.called("admin_notifications", "eq")!.args).toEqual(["is_read", false]);
    expect(db.called("admin_notifications", "limit")!.args[0]).toBe(5);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects a bad limit or flag", async () => {
    for (const qs of ["?limit=0", "?limit=101", "?limit=x", "?unread=maybe"]) expect((await list(req("GET", qs))).status, qs).toBe(400);
  });
});

describe("GET /notifications/unread-count", () => {
  it("returns just the number", async () => {
    expect((await (await unread(req("GET"))).json()).data).toEqual({ count: 3 });
  });
});

describe("marking read", () => {
  it("marks one read, recording who", async () => {
    expect((await markOne(req("PUT"), { params: Promise.resolve({ id: ID }) })).status).toBe(200);
    expect(db.called("admin_notifications", "update")!.args[0]).toMatchObject({ is_read: true, read_by: "admin-1" });
    expect((await markOne(req("PUT"), { params: Promise.resolve({ id: "nope" }) })).status).toBe(404);
  });
  it("marks everything unread as read", async () => {
    expect((await markAll(req("PUT"))).status).toBe(200);
    expect(db.called("admin_notifications", "eq")!.args).toEqual(["is_read", false]);
  });
});

describe("createAdminNotification (what the app itself raises)", () => {
  it("adds one, and doesn't repeat an unread one about the same thing", async () => {
    db.results.admin_notifications = { data: [], error: null };
    await createAdminNotification(db.client, { type: "low_stock", title: "Shirt is low", message: "2 left", link: "/admin/inventory?v=1" });
    expect(db.called("admin_notifications", "insert")!.args[0]).toMatchObject({ type: "low_stock", link: "/admin/inventory?v=1" });
    db.reset();
    db.results.admin_notifications = { data: [{ id: "n1" }], error: null };
    await createAdminNotification(db.client, { type: "low_stock", title: "Shirt is low", message: "2 left", link: "/admin/inventory?v=1" });
    expect(db.called("admin_notifications", "insert")).toBeUndefined();
  });
  it("never throws, and trims long text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    db.results.admin_notifications = { data: null, error: { message: "boom" } };
    await expect(createAdminNotification(db.client, { type: "new_order", title: "x".repeat(300), message: "m", link: null })).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
