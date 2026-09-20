import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));

const mockRequirePermission = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
}));
const mockAdjust = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({ adjustInventory: (...a: unknown[]) => mockAdjust(...a) }));

import { NextRequest, NextResponse } from "next/server";
import { GET as listInventory } from "../app/api/v1/inventory/route";
import { GET as listMovements } from "../app/api/v1/inventory/movements/route";
import { PUT as adjust } from "../app/api/v1/inventory/[id]/route";

const VARIANT = "11111111-1111-4111-8111-111111111111";
const INV_ID = "22222222-2222-4222-8222-222222222222";
const KEEPER = { ok: true, user: { id: "keeper-1", email: null }, role: "inventory_staff", isAdmin: false, permissions: { can_manage_inventory: true } };
const deny = (status: number) => ({ ok: false, response: NextResponse.json({ code: "X" }, { status }) });
const r = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/inventory", { method, body: body === undefined ? undefined : JSON.stringify(body) });
const put = (body: unknown, id = VARIANT) => adjust(r("PUT", body), { params: Promise.resolve({ id }) });

describe("inventory routes require the inventory grant", () => {
  beforeEach(() => {
    db.reset();
    mockRequirePermission.mockReset().mockResolvedValue(KEEPER);
    mockAdjust.mockReset().mockResolvedValue({ ok: true });
    db.results.inventory = { data: [], error: null };
    db.results.stock_movements = { data: [], error: null };
  });

  describe.each([
    ["GET /inventory", () => listInventory(r("GET"))],
    ["GET /inventory/movements", () => listMovements(r("GET"))],
    ["PUT /inventory/[id]", () => put({ adjustment_type: "add", quantity: 1, reason: "restock" })],
  ])("%s", (_name, call) => {
    it.each([401, 403])("is refused with %s and never touches the database", async (status) => {
      mockRequirePermission.mockResolvedValue(deny(status));
      const res = await call();
      expect(res.status).toBe(status);
      expect(db.touched).toHaveLength(0);
    });

    it("asks for the can_manage_inventory grant specifically", async () => {
      await call();
      expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), "can_manage_inventory");
    });
  });

  it("GET /inventory works for someone with the grant", async () => {
    expect((await listInventory(r("GET"))).status).toBe(200);
  });

  it("GET /inventory/movements works for someone with the grant", async () => {
    expect((await listMovements(r("GET"))).status).toBe(200);
  });
});

describe("PUT /inventory/[id] (stock adjustment)", () => {
  beforeEach(() => {
    db.reset();
    mockRequirePermission.mockReset().mockResolvedValue(KEEPER);
    mockAdjust.mockReset().mockResolvedValue({ ok: true });
    db.results.inventory = { data: { id: INV_ID, variant_id: VARIANT, quantity: 10, reserved_quantity: 2, low_stock_threshold: 5 }, error: null };
    db.results.stock_movements = { data: null, error: null };
  });

  it("refuses an id that isn't a uuid without querying (it is spliced into a filter otherwise)", async () => {
    const res = await put({ adjustment_type: "add", quantity: 1, reason: "x" }, "x),status.eq.draft,(id.eq.1");
    expect(res.status).toBe(404);
    expect(db.touched).toHaveLength(0);
  });

  it.each([
    ["an unknown adjustment type", { adjustment_type: "explode", quantity: 1, reason: "x" }],
    ["quantity 0 for an add", { adjustment_type: "add", quantity: 0, reason: "x" }],
    ["a negative quantity", { adjustment_type: "add", quantity: -5, reason: "x" }],
    ["a fractional quantity", { adjustment_type: "add", quantity: 1.5, reason: "x" }],
    ["a string quantity", { adjustment_type: "add", quantity: "5", reason: "x" }],
    ["NaN", { adjustment_type: "add", quantity: "abc", reason: "x" }],
    ["an absurd quantity", { adjustment_type: "add", quantity: 10_000_000, reason: "x" }],
    ["a change with no reason", { adjustment_type: "add", quantity: 3 }],
    ["a negative threshold", { low_stock_threshold: -1 }],
    ["a fractional threshold", { low_stock_threshold: 2.5 }],
    ["nothing to change", {}],
    ["a non-object body", "hello"],
  ])("rejects %s with a 400 and changes nothing", async (_n, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(mockAdjust).not.toHaveBeenCalled();
    expect(db.called("stock_movements", "insert")).toBeUndefined();
  });

  it("adds stock atomically and records who did it", async () => {
    const res = await put({ adjustment_type: "add", quantity: 5, reason: "restock", notes: "delivery" });
    expect(res.status).toBe(200);
    expect(mockAdjust).toHaveBeenCalledWith(expect.anything(), { variantId: VARIANT, deltaQuantity: 5 });
    expect(db.called("stock_movements", "insert")!.args[0]).toMatchObject({ variant_id: VARIANT, delta: 5, reason: "restock", actor_id: "keeper-1", notes: "delivery" });
  });

  it("removing more than exists clamps at zero instead of going negative", async () => {
    await put({ adjustment_type: "remove", quantity: 999, reason: "damaged" });
    expect(mockAdjust).toHaveBeenCalledWith(expect.anything(), { variantId: VARIANT, deltaQuantity: -10 });
  });

  it("'set' moves the count to exactly the number given", async () => {
    await put({ adjustment_type: "set", quantity: 4, reason: "stock take" });
    expect(mockAdjust).toHaveBeenCalledWith(expect.anything(), { variantId: VARIANT, deltaQuantity: -6 });
  });

  it("a threshold change alone touches no stock and writes no movement", async () => {
    const res = await put({ low_stock_threshold: 8 });
    expect(res.status).toBe(200);
    expect(mockAdjust).not.toHaveBeenCalled();
    expect(db.called("stock_movements", "insert")).toBeUndefined();
    expect(db.called("inventory", "update")!.args[0]).toMatchObject({ low_stock_threshold: 8 });
  });

  it("answers 409 when the count changed under it (another sale or adjustment), and records nothing", async () => {
    mockAdjust.mockResolvedValue({ ok: false, reason: "CONTENDED" });
    const res = await put({ adjustment_type: "add", quantity: 1, reason: "x" });
    expect(res.status).toBe(409);
    expect(db.called("stock_movements", "insert")).toBeUndefined();
  });

  it("404s a variant with no inventory row", async () => {
    db.results.inventory = { data: null, error: null };
    expect((await put({ adjustment_type: "add", quantity: 1, reason: "x" })).status).toBe(404);
  });
});
