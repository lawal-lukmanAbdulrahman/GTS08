// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";
import { movementReason } from "../app/api/v1/_lib/inventory-reasons";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
const mockPerm = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockPerm(...a),
}));
const mockAdjustAll = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({ adjustAll: (...a: unknown[]) => mockAdjustAll(...a), adjustInventory: vi.fn(), rollback: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/inventory/adjustments/route";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const post = (body: unknown) => POST(new NextRequest("http://localhost:3000/api/v1/inventory/adjustments", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  db.reset();
  mockPerm.mockReset().mockResolvedValue({ ok: true, user: { id: "keeper-1" }, isAdmin: false });
  mockAdjustAll.mockReset().mockResolvedValue({ ok: true });
  db.results.inventory = { data: [{ variant_id: V1, quantity: 10, reserved_quantity: 2 }, { variant_id: V2, quantity: 4, reserved_quantity: 0 }], error: null };
  db.results.stock_movements = { data: null, error: null };
});

describe("movementReason", () => {
  it("keeps the recorded reasons and files anything else as an adjustment, keeping the words in the note", () => {
    expect(movementReason("write_off", null)).toEqual({ reason: "write_off", notes: null });
    expect(movementReason("Damaged in transit", "box 4")).toEqual({ reason: "adjustment", notes: "Damaged in transit: box 4" });
    expect(movementReason("Damaged in transit", null)).toEqual({ reason: "adjustment", notes: "Damaged in transit" });
  });
});

describe("POST /inventory/adjustments (several stock changes as one)", () => {
  it("needs can_manage_inventory", async () => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await post({ adjustments: [] })).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });

  it("validates the list and every line", async () => {
    const line = { variant_id: V1, type: "add", quantity: 1, reason: "restock" };
    for (const body of [
      {}, { adjustments: [] }, { adjustments: "x" }, { adjustments: Array.from({ length: 51 }, () => line) },
      { adjustments: [{ ...line, variant_id: "nope" }] }, { adjustments: [{ ...line, type: "explode" }] },
      { adjustments: [{ ...line, quantity: 0 }] }, { adjustments: [{ ...line, quantity: 1.5 }] }, { adjustments: [{ ...line, quantity: 2_000_000 }] },
      { adjustments: [{ ...line, reason: "because" }] }, { adjustments: [{ ...line, notes: "x".repeat(501) }] },
      { adjustments: [line, { ...line, quantity: 2 }] }, // the same variant twice
    ]) {
      expect((await post(body)).status, JSON.stringify(body).slice(0, 70)).toBe(400);
    }
    expect((await post("{nope")).status).toBe(400);
  });

  it("applies add, remove and set together, and records a movement for each", async () => {
    const res = await post({ adjustments: [
      { variant_id: V1, type: "add", quantity: 5, reason: "restock", notes: "delivery" },
      { variant_id: V2, type: "set", quantity: 1, reason: "adjustment" },
    ] });
    expect(res.status).toBe(200);
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [
      { variantId: V1, deltaQuantity: 5 },
      { variantId: V2, deltaQuantity: -3, requireAvailable: 3 },
    ]);
    expect(db.called("stock_movements", "insert")!.args[0]).toEqual([
      expect.objectContaining({ variant_id: V1, delta: 5, reason: "restock", actor_id: "keeper-1", notes: "delivery" }),
      expect.objectContaining({ variant_id: V2, delta: -3, reason: "adjustment", actor_id: "keeper-1" }),
    ]);
    expect((await res.json()).data.applied).toBe(2);
  });

  it("won't remove stock that's reserved for an order", async () => {
    await post({ adjustments: [{ variant_id: V1, type: "remove", quantity: 8, reason: "write_off" }] });
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaQuantity: -8, requireAvailable: 8 }]);
  });

  it("skips lines that change nothing, and refuses an unknown variant", async () => {
    const same = await post({ adjustments: [{ variant_id: V2, type: "set", quantity: 4, reason: "correction" }] });
    expect(same.status).toBe(200);
    expect(mockAdjustAll).not.toHaveBeenCalled();
    db.results.inventory = { data: [], error: null };
    expect((await post({ adjustments: [{ variant_id: V1, type: "add", quantity: 1, reason: "restock" }] })).status).toBe(404);
  });

  it("applies all or none: a shortfall changes nothing and names the variant", async () => {
    mockAdjustAll.mockResolvedValue({ ok: false, reason: "INSUFFICIENT_STOCK", available: 1, failedVariantId: V1 });
    const res = await post({ adjustments: [{ variant_id: V1, type: "remove", quantity: 8, reason: "write_off" }] });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INSUFFICIENT_STOCK");
    expect(body.details).toMatchObject({ variant_id: V1, available: 1 });
    expect(db.called("stock_movements", "insert")).toBeUndefined();
  });

  it("never echoes internal errors", async () => {
    db.results.inventory = { data: null, error: { message: "relation secret_t missing" } };
    const res = await post({ adjustments: [{ variant_id: V1, type: "add", quantity: 1, reason: "restock" }] });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
});
