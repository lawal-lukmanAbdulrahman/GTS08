import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

const mockAdjustAll = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({ adjustAll: (...a: unknown[]) => mockAdjustAll(...a) }));
const mockTransition = vi.fn();
vi.mock("../app/api/v1/pos/_lib/order-status", () => ({ transitionOrderStatus: (...a: unknown[]) => mockTransition(...a) }));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/webhooks/paystack/route";

const SECRET = "sk_test_unit_secret";
const sign = (raw: string, secret = SECRET) => crypto.createHmac("sha512", secret).update(raw).digest("hex");
const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const V1 = "22222222-2222-4222-8222-222222222222";

const event = (over: Record<string, unknown> = {}) => ({
  event: "charge.success",
  data: { id: 99, reference: "ref-1", amount: 5000000, currency: "NGN", channel: "card", fees: 75000, ...over },
});
function post(payload: unknown, opts: { signature?: string | null; raw?: string } = {}) {
  const raw = opts.raw ?? JSON.stringify(payload);
  const headers: Record<string, string> = {};
  if (opts.signature !== null) headers["x-paystack-signature"] = opts.signature ?? sign(raw);
  return POST(new NextRequest("http://localhost:3000/api/v1/webhooks/paystack", { method: "POST", body: raw, headers }));
}
const updates = (table: string) => db.calls[table]?.filter((c) => c.method === "update").map((c) => c.args[0]) ?? [];

describe("POST /webhooks/paystack", () => {
  const original = process.env.PAYSTACK_SECRET_KEY;
  beforeEach(() => {
    db.reset();
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    mockAdjustAll.mockReset().mockResolvedValue({ ok: true, applied: [] });
    mockTransition.mockReset().mockResolvedValue(true);
    db.results.webhook_events = { data: { id: "e1", processed: false }, error: null };
    db.results.transactions = { data: { order_id: ORDER_ID }, error: null };
    db.results.orders = { data: { id: ORDER_ID, status: "pending_payment", total: 5000000 }, error: null };
    db.results.order_items = { data: [{ variant_id: V1, quantity: 2 }], error: null };
  });
  afterEach(() => {
    if (original === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = original;
  });

  describe("signature (security contract #3: verified first, and it can never be skipped)", () => {
    it("refuses to run at all when no secret is configured, and touches nothing", async () => {
      delete process.env.PAYSTACK_SECRET_KEY;
      const res = await post(event(), { signature: sign(JSON.stringify(event()), "dummy_secret_for_tests") });
      expect(res.status).toBe(500);
      expect((await res.json()).code).toBe("WEBHOOK_NOT_CONFIGURED");
      expect(db.touched).toHaveLength(0);
    });

    it("refuses a blank secret too (the old default must not work)", async () => {
      process.env.PAYSTACK_SECRET_KEY = "   ";
      const res = await post(event());
      expect(res.status).toBe(500);
      expect(db.touched).toHaveLength(0);
    });

    it("refuses a request with no signature", async () => {
      const res = await post(event(), { signature: null });
      expect(res.status).toBe(401);
      expect(db.touched).toHaveLength(0);
    });

    it("refuses a forged signature", async () => {
      const res = await post(event(), { signature: "deadbeef" });
      expect(res.status).toBe(401);
      expect(db.touched).toHaveLength(0);
    });

    it("refuses a signature made with a different secret", async () => {
      const raw = JSON.stringify(event());
      const res = await post(event(), { raw, signature: sign(raw, "someone_elses_secret") });
      expect(res.status).toBe(401);
    });

    it("refuses a signature that no longer matches an altered body", async () => {
      const raw = JSON.stringify(event());
      const res = await post(event({ amount: 1 }), { signature: sign(raw) });
      expect(res.status).toBe(401);
    });
  });

  it("rejects a signed body that isn't JSON", async () => {
    const raw = "{not json";
    const res = await post(null, { raw, signature: sign(raw) });
    expect(res.status).toBe(400);
  });

  describe("charge.success", () => {
    it("marks the pending order paid, converts the reservation to a sale, and records the payment", async () => {
      const res = await post(event());
      expect(res.status).toBe(200);
      expect(mockTransition).toHaveBeenCalledWith(expect.anything(), ORDER_ID, "pending_payment", expect.objectContaining({ status: "paid" }));
      expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaQuantity: -2, deltaReserved: -2, clampReserved: true }]);
      expect(updates("transactions")[0]).toMatchObject({ payment_status: "success", paystack_transaction_id: "99", paystack_channel: "card", paystack_fees: 75000 });
      expect(updates("webhook_events")[0]).toMatchObject({ processed: true });
    });

    it("does NOT pay an order when the amount doesn't match what it costs", async () => {
      const res = await post(event({ amount: 100 }));
      expect(res.status).toBe(200); // acknowledged so Paystack stops retrying; it's flagged, not fulfilled
      expect(mockTransition).not.toHaveBeenCalled();
      expect(mockAdjustAll).not.toHaveBeenCalled();
      expect(updates("webhook_events")[0]).toMatchObject({ processed: true });
      expect(JSON.stringify(db.calls.webhook_events)).toMatch(/amount_mismatch/);
    });

    it("does NOT pay when the currency isn't naira", async () => {
      await post(event({ currency: "USD" }));
      expect(mockTransition).not.toHaveBeenCalled();
    });

    it("does nothing to stock when the order was already claimed (paid, cancelled, or a racing duplicate)", async () => {
      mockTransition.mockResolvedValue(false);
      const res = await post(event());
      expect(res.status).toBe(200);
      expect(mockAdjustAll).not.toHaveBeenCalled();
    });

    it("puts the order back and asks Paystack to retry if stock can't be updated", async () => {
      mockAdjustAll.mockResolvedValue({ ok: false, reason: "CONTENDED", failedVariantId: V1 });
      const res = await post(event());
      expect(res.status).toBe(503);
      expect(mockTransition).toHaveBeenLastCalledWith(expect.anything(), ORDER_ID, "paid", expect.objectContaining({ status: "pending_payment" }));
      expect(updates("webhook_events").some((u: any) => u?.processed === true)).toBe(false);
    });

    it("acknowledges a reference it doesn't know without paying anything", async () => {
      db.results.transactions = { data: null, error: null };
      const res = await post(event());
      expect(res.status).toBe(200);
      expect(mockTransition).not.toHaveBeenCalled();
    });
  });

  it("acknowledges and records event types it doesn't act on", async () => {
    const res = await post({ event: "transfer.success", data: { reference: "t-1" } });
    expect(res.status).toBe(200);
    expect(mockTransition).not.toHaveBeenCalled();
    expect(updates("webhook_events")[0]).toMatchObject({ processed: true });
  });

  it("does nothing the second time it sees an event it already processed", async () => {
    db.results.webhook_events = { data: { id: "e1", processed: true }, error: null };
    const res = await post(event());
    expect(res.status).toBe(200);
    expect(mockTransition).not.toHaveBeenCalled();
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });

  it("returns 500 (so Paystack retries) on an unexpected failure instead of pretending it worked", async () => {
    mockTransition.mockRejectedValue(new Error("db down"));
    const res = await post(event());
    expect(res.status).toBe(500);
  });
});
