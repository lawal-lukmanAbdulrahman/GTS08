// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAdjustAll = vi.fn();
const mockAdjust = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({
  adjustAll: (...a: unknown[]) => mockAdjustAll(...a),
  adjustInventory: (...a: unknown[]) => mockAdjust(...a),
}));
const mockTransition = vi.fn();
vi.mock("../app/api/v1/pos/_lib/order-status", () => ({ transitionOrderStatus: (...a: unknown[]) => mockTransition(...a) }));

import { NextRequest } from "next/server";
import { GET as expireGet, POST as expirePost } from "../app/api/v1/cron/expire-orders/route";
import { GET as cleanupGet, POST as cleanupPost } from "../app/api/v1/cron/cleanup-reservations/route";

const SECRET = "cron-secret-for-tests";
const call = (handler: (r: NextRequest) => Promise<Response>, auth?: string | null) =>
  handler(new NextRequest("http://localhost:3000/api/v1/cron/x", { method: "POST", headers: auth === null ? {} : { authorization: auth ?? `Bearer ${SECRET}` } }));
const V1 = "11111111-1111-4111-8111-111111111111";

describe("cron authentication (fails closed)", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => (original === undefined ? delete process.env.CRON_SECRET : (process.env.CRON_SECRET = original)));
  beforeEach(() => db.reset());

  it.each([
    ["expire-orders POST", expirePost], ["expire-orders GET (Vercel cron uses GET)", expireGet],
    ["cleanup-reservations POST", cleanupPost], ["cleanup-reservations GET", cleanupGet],
  ])("%s refuses to run when no secret is configured", async (_n, h) => {
    delete process.env.CRON_SECRET;
    const res = await call(h as never);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("CRON_NOT_CONFIGURED");
    expect(db.touched).toHaveLength(0);
  });

  it.each([["expire-orders", expirePost], ["cleanup-reservations", cleanupPost]])("%s refuses a missing or wrong secret", async (_n, h) => {
    process.env.CRON_SECRET = SECRET;
    expect((await call(h as never, null)).status).toBe(401);
    expect((await call(h as never, "Bearer nope")).status).toBe(401);
    expect((await call(h as never, `Bearer ${SECRET}x`)).status).toBe(401);
    expect(db.touched).toHaveLength(0);
  });
});

describe("expire-orders", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    db.reset();
    mockAdjustAll.mockReset().mockResolvedValue({ ok: true });
    mockTransition.mockReset().mockResolvedValue(true);
  });

  // Each channel is queried separately; give the rows only to the query for their channel.
  const forChannel = (channel: string, rows: unknown[]) => (calls: { method: string; args: unknown[] }[]) => ({
    data: calls.some((c) => c.method === "eq" && c.args[0] === "channel" && c.args[1] === channel) ? rows : [],
    error: null,
  });
  const stale = (id: string, channel: string) => ({ id, channel, internal_notes: channel === "whatsapp" ? "WhatsApp customer: Ada (0803)" : null, items: [{ variant_id: V1, quantity: 2 }, { variant_id: null, quantity: 1 }] });

  it("cancels unpaid orders, keeping their notes, and releases what they reserved", async () => {
    db.results.orders = forChannel("whatsapp", [stale("o1", "whatsapp")]);
    const res = await call(expirePost);
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(expect.anything(), "o1", "pending_payment", expect.objectContaining({ status: "cancelled", internal_notes: expect.stringContaining("WhatsApp customer: Ada") }));
    expect(mockTransition.mock.calls[0]![3].internal_notes).toMatch(/Expired/);
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaReserved: -2, clampReserved: true }]);
  });

  it("only looks at orders still waiting for payment, and older than the expiry", async () => {
    db.results.orders = { data: [], error: null };
    await call(expirePost);
    const calls = db.calls.orders!;
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "pending_payment")).toBe(true);
    expect(calls.some((c) => c.method === "lt" && c.args[0] === "created_at")).toBe(true);
  });

  it("does not release stock for an order someone paid a moment ago (lost the race)", async () => {
    db.results.orders = forChannel("whatsapp", [stale("o1", "whatsapp")]);
    mockTransition.mockResolvedValue(false);
    const res = await call(expirePost);
    expect(mockAdjustAll).not.toHaveBeenCalled();
    expect((await res.json()).data.expired).toBe(0);
  });

  it("reports how many it expired, and keeps going if one fails", async () => {
    db.results.orders = forChannel("whatsapp", [stale("o1", "whatsapp"), stale("o2", "whatsapp")]);
    mockTransition.mockRejectedValueOnce(new Error("db")).mockResolvedValue(true);
    const res = await call(expirePost);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ expired: 1, failed: 1 });
  });

  it("running it twice in a row changes nothing the second time", async () => {
    db.results.orders = { data: [], error: null };
    const res = await call(expirePost);
    expect((await res.json()).data).toMatchObject({ expired: 0 });
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });

  it("a database error is a 500 that doesn't echo internals", async () => {
    db.results.orders = { data: null, error: { message: 'relation "x" does not exist' } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(expirePost);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/relation/);
  });
});

describe("cleanup-reservations", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    db.reset();
    mockAdjust.mockReset().mockResolvedValue({ ok: true });
  });

  it("releases each expired reservation from inventory and marks it released", async () => {
    db.results.checkout_reservations = { data: [{ id: "r1", variant_id: V1, quantity: 3 }], error: null };
    const res = await call(cleanupPost);
    expect(res.status).toBe(200);
    expect(mockAdjust).toHaveBeenCalledWith(expect.anything(), { variantId: V1, deltaReserved: -3, clampReserved: true });
    const updates = db.calls.checkout_reservations!.filter((c) => c.method === "update").map((c) => c.args[0]);
    expect(updates).toContainEqual({ released: true });
    expect((await res.json()).data.released).toBe(1);
  });

  it("only touches reservations that are expired and not yet released", async () => {
    db.results.checkout_reservations = { data: [], error: null };
    await call(cleanupPost);
    const c = db.calls.checkout_reservations!;
    expect(c.some((x) => x.method === "eq" && x.args[0] === "released" && x.args[1] === false)).toBe(true);
    expect(c.some((x) => x.method === "lt" && x.args[0] === "expires_at")).toBe(true);
  });

  it("leaves a reservation alone (to retry next run) if the stock update fails", async () => {
    db.results.checkout_reservations = { data: [{ id: "r1", variant_id: V1, quantity: 3 }], error: null };
    mockAdjust.mockResolvedValue({ ok: false, reason: "CONTENTION" });
    const res = await call(cleanupPost);
    const updates = db.calls.checkout_reservations!.filter((c) => c.method === "update");
    expect(updates).toHaveLength(0);
    expect((await res.json()).data).toMatchObject({ released: 0, failed: 1 });
  });
});
