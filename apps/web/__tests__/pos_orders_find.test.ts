// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({ requirePosAccess: (...a: unknown[]) => mockAccess(...a) }));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "../app/api/v1/pos/orders/route";

const CASHIER = { ok: true, user: { id: "cashier-1", email: null }, role: "cashier", isAdmin: false, fullName: "Ada", permissions: {} };
const ADMIN = { ...CASHIER, user: { id: "admin-1", email: null }, role: "admin", isAdmin: true };
const find = (qs = "") => GET(new NextRequest(`http://localhost:3000/api/v1/pos/orders${qs}`));
const eqs = () => (db.calls.orders ?? []).filter((c) => c.method === "eq").map((c) => `${c.args[0]}=${c.args[1]}`);
const has = (m: string, col: string) => (db.calls.orders ?? []).some((c) => c.method === m && c.args[0] === col);

describe("GET /pos/orders (find a sale)", () => {
  beforeEach(() => {
    db.reset();
    mockAccess.mockReset().mockResolvedValue(CASHIER);
    db.results.orders = { data: [{ id: "o1", order_number: "GTS-202609-000001", channel: "walk_in", status: "completed", total: 100, created_at: "2026-09-19T10:00:00Z" }], error: null };
  });

  it("needs POS access", async () => {
    mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ code: "POS_ACCESS_DENIED" }, { status: 403 }) });
    expect((await find()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });

  it("lists only sales this cashier took payment for", async () => {
    const res = await find();
    expect(res.status).toBe(200);
    expect(eqs()).toContain("transactions.confirmed_by=cashier-1");
    expect((await res.json()).data).toHaveLength(1);
  });

  it("lets an admin see anyone's", async () => {
    mockAccess.mockResolvedValue(ADMIN);
    await find();
    expect(eqs().some((e) => e.startsWith("transactions.confirmed_by"))).toBe(false);
  });

  it("only ever returns walk-in and WhatsApp sales", async () => {
    await find();
    expect(db.calls.orders!.some((c) => c.method === "in" && c.args[0] === "channel")).toBe(true);
  });

  it("searches by part of an order number", async () => {
    await find("?q=000123");
    expect(has("ilike", "order_number")).toBe(true);
    const arg = db.calls.orders!.find((c) => c.method === "ilike")!.args[1];
    expect(arg).toBe("%000123%");
  });

  it("strips anything that isn't part of an order number from the search", async () => {
    await find("?q=" + encodeURIComponent("GTS,(x)%;'--"));
    const arg = String(db.calls.orders!.find((c) => c.method === "ilike")?.args[1] ?? "");
    expect(arg).not.toMatch(/[,()';]|--/);
  });

  it("defaults to the last 30 days and can be narrowed by date, in Lagos days", async () => {
    await find();
    expect(has("gte", "created_at")).toBe(true);
    db.reset();
    db.results.orders = { data: [], error: null };
    await find("?from=2026-09-01&to=2026-09-05");
    const gte = db.calls.orders!.find((c) => c.method === "gte")!.args[1] as string;
    const lt = db.calls.orders!.find((c) => c.method === "lt")!.args[1] as string;
    expect(gte).toBe("2026-08-31T23:00:00.000Z"); // midnight Sept 1 in Lagos
    expect(lt).toBe("2026-09-05T23:00:00.000Z"); // end of Sept 5 in Lagos
  });

  it("ignores dates that aren't dates", async () => {
    const res = await find("?from=not-a-date&to=';drop");
    expect(res.status).toBe(200);
  });

  it("caps the page size, newest first", async () => {
    await find("?limit=9999");
    expect(db.calls.orders!.find((c) => c.method === "limit")!.args[0]).toBeLessThanOrEqual(30);
    expect(db.calls.orders!.find((c) => c.method === "order")!.args[1]).toMatchObject({ ascending: false });
  });

  it("never returns costs or other people's details", async () => {
    const res = await find();
    expect(JSON.stringify(await res.json())).not.toMatch(/cost|email|phone/i);
  });

  it("a database error is a clean 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.results.orders = { data: null, error: { message: "boom" } };
    expect((await find()).status).toBe(500);
  });
});
