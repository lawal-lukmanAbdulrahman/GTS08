// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
vi.mock("../app/api/v1/auth/utils", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/auth/utils")>()),
  getAuthenticatedUser: vi.fn().mockResolvedValue(null),
}));
const mockAdjustAll = vi.fn();
const mockRollback = vi.fn();
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({
  adjustAll: (...a: unknown[]) => mockAdjustAll(...a),
  rollback: (...a: unknown[]) => mockRollback(...a),
}));

const mockInit = vi.fn();
vi.mock("../app/api/v1/_lib/paystack", () => ({ initializePayment: (...a: unknown[]) => mockInit(...a) }));

import { getAuthenticatedUser } from "../app/api/v1/auth/utils";
import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/checkout/route";

const V1 = "11111111-1111-4111-8111-111111111111";
const VARIANT = {
  id: V1, size: "M", color: "Black", sku: "SKU-1", price_modifier: 50000, is_active: true,
  inventory: { quantity: 10, reserved_quantity: 0 },
  product: { id: "p1", name: "GTS Oxford Shirt", base_price: 1500000, status: "active" },
};
const BASE = {
  customer: { email: "Buyer@Example.com", fullName: "Bola Buyer", phone: "08012345678" },
  address: { addressLine1: "1 Marina", city: "Lagos", state: "Lagos" },
  deliveryOption: "door",
  paymentMethod: "paystack",
  items: [{ variant_id: V1, quantity: 2 }],
};
const post = (body: unknown) => POST(new NextRequest("http://localhost:3000/api/v1/checkout", { method: "POST", body: JSON.stringify(body) }));
const inserted = (table: string) => db.calls[table]?.filter((c) => c.method === "insert").map((c) => c.args[0] as Record<string, any>) ?? [];

beforeEach(() => {
  db.reset();
  mockAdjustAll.mockReset().mockResolvedValue({ ok: true });
  mockRollback.mockReset().mockResolvedValue(undefined);
  vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
  mockInit.mockReset().mockResolvedValue({ ok: true, authorizationUrl: "https://checkout.paystack.com/abc" });
  db.results.product_variants = { data: [VARIANT], error: null };
  db.results.customers = { data: { id: "cust-1" }, error: null };
  db.results.addresses = { data: { id: "addr-1" }, error: null };
  db.results.orders = { data: { id: "order-1", order_number: "GTS-202609-000009", status: "pending_payment", subtotal: 3100000, delivery_fee: 150000, discount_amount: 0, total: 3250000 }, error: null };
  db.results.order_items = { data: null, error: null };
  db.results.transactions = { data: null, error: null };
});

describe("POST /api/v1/checkout is decided by the server, not the browser", () => {
  it("prices from the database and ignores any price or discount the browser sends", async () => {
    const res = await post({
      ...BASE,
      discountPercent: 100,
      items: [{ variant_id: V1, quantity: 2, price: 1, unit_price: 1, product: { priceNum: 0.01 } }],
    });
    expect(res.status).toBe(200);
    const order = inserted("orders")[0]!;
    // (15,000 + 500 modifier) x 2 = 31,000 naira; door delivery 1,500 naira; all in kobo.
    expect(order).toMatchObject({ subtotal: 3100000, discount_amount: 0, delivery_fee: 150000, total: 3250000 });
    const lines = db.called("order_items", "insert")!.args[0] as Array<Record<string, any>>;
    expect(lines[0]).toMatchObject({ variant_id: V1, quantity: 2, unit_price: 1550000, line_total: 3100000 });
  });

  it("creates the order unpaid and never marks it paid itself", async () => {
    await post({ ...BASE, paymentMethod: "paystack" });
    const order = inserted("orders")[0]!;
    expect(order.status).toBe("pending_payment");
    expect(order.paid_at ?? null).toBeNull();
    const tx = inserted("transactions")[0]!;
    expect(tx).toMatchObject({ order_id: "order-1", payment_status: "pending", amount: 3250000 });
    expect(String(tx.paystack_reference)).toMatch(/^gts_/);
  });

  it("holds the stock for the order, requiring it to be available", async () => {
    await post(BASE);
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaReserved: 2, requireAvailable: 2 }]);
  });

  it("returns the reference the customer pays with, and a pending status", async () => {
    const body = await (await post(BASE)).json();
    expect(body.data.status).toBe("pending_payment");
    expect(body.data.total).toBe(3250000);
    expect(body.data.payment).toMatchObject({ status: "pending", reference: inserted("transactions")[0]!.paystack_reference });
  });

  it("starts the payment with the server's total and returns the page to pay on", async () => {
    const body = await (await post(BASE)).json();
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({
      email: "buyer@example.com",
      amountKobo: 3250000,
      reference: inserted("transactions")[0]!.paystack_reference,
      callbackUrl: expect.stringMatching(/\/checkout\/complete$/),
    }));
    expect(body.data.payment.authorization_url).toBe("https://checkout.paystack.com/abc");
  });

  it("cancels the order and frees the stock when payment can't be started", async () => {
    mockInit.mockResolvedValue({ ok: false, reason: "NOT_CONFIGURED" });
    const res = await post(BASE);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("PAYMENT_UNAVAILABLE");
    expect(mockRollback).toHaveBeenCalled();
    expect(db.calls.orders?.some((c) => c.method === "update")).toBe(true);
  });

  it("refuses, and creates nothing, when there isn't enough stock", async () => {
    mockAdjustAll.mockResolvedValue({ ok: false, reason: "INSUFFICIENT_STOCK", available: 1, failedVariantId: V1 });
    const res = await post(BASE);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("INSUFFICIENT_STOCK");
    expect(inserted("orders")).toHaveLength(0);
  });

  it("refuses a product that is a draft or no longer sold", async () => {
    db.results.product_variants = { data: [{ ...VARIANT, product: { ...VARIANT.product, status: "draft" } }], error: null };
    let res = await post(BASE);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ITEM_UNAVAILABLE");
    db.results.product_variants = { data: [{ ...VARIANT, is_active: false }], error: null };
    res = await post(BASE);
    expect(res.status).toBe(400);
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });

  it("refuses an unknown variant, and cart lines that aren't real variant ids", async () => {
    db.results.product_variants = { data: [], error: null };
    expect((await (await post(BASE)).json()).code).toBe("ITEM_UNAVAILABLE");
    const res = await post({ ...BASE, items: [{ id: "sample-1", title: "Aura V1 Pro Vacuum", price: 10, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ITEMS");
  });

  it("accepts cart lines named by product slug, size and colour, and still prices them from the database", async () => {
    db.results.products = { data: [{ slug: "oxford-shirt", status: "active", variants: [{ id: V1, size: "M", color: "Black", is_active: true }, { id: "22222222-2222-4222-8222-222222222222", size: "L", color: "Black", is_active: true }] }], error: null };
    const res = await post({ ...BASE, items: [{ product_slug: "oxford-shirt", size: "M", color: "black", quantity: 2, price: 1 }] });
    expect(res.status).toBe(200);
    expect(mockAdjustAll).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaReserved: 2, requireAvailable: 2 }]);
    expect(inserted("orders")[0]).toMatchObject({ subtotal: 3100000 });
  });

  it("refuses a product slug that doesn't exist", async () => {
    db.results.products = { data: [], error: null };
    const res = await post({ ...BASE, items: [{ product_slug: "ghost", quantity: 1 }] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ITEM_UNAVAILABLE");
    expect(mockAdjustAll).not.toHaveBeenCalled();
  });

  describe("promo codes", () => {
    const PROMO = { id: "pr1", code: "WELCOME10", discount_type: "percentage", discount_value: 10, min_order_amount: 0, max_uses: null, used_count: 0, starts_at: "2020-01-01T00:00:00Z", expires_at: null, is_active: true };
    it("applies a real code from the database's own rules, off the server's subtotal", async () => {
      db.results.promos = { data: PROMO, error: null };
      const res = await post({ ...BASE, promoCode: "welcome10", discountPercent: 90 });
      expect(res.status).toBe(200);
      // subtotal 31,000 naira; 10% off = 3,100; delivery 1,500
      expect(inserted("orders")[0]).toMatchObject({ subtotal: 3100000, discount_amount: 310000, total: 2940000, promo_code: "WELCOME10" });
      expect(inserted("transactions")[0]).toMatchObject({ amount: 2940000 });
      expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ amountKobo: 2940000 }));
    });
    it("refuses an unknown or unusable code before holding any stock, without saying which", async () => {
      db.results.promos = { data: null, error: null };
      const unknown = await post({ ...BASE, promoCode: "NOPE1" });
      db.results.promos = { data: { ...PROMO, is_active: false }, error: null };
      const off = await post({ ...BASE, promoCode: "WELCOME10" });
      expect(unknown.status).toBe(400);
      expect((await unknown.json()).code).toBe("INVALID_PROMO");
      expect((await off.json()).code).toBe("INVALID_PROMO");
      expect(mockAdjustAll).not.toHaveBeenCalled();
      expect(inserted("orders")).toHaveLength(0);
    });
    it("refuses a code when the cart is under its minimum", async () => {
      db.results.promos = { data: { ...PROMO, min_order_amount: 99999999 }, error: null };
      const res = await post({ ...BASE, promoCode: "WELCOME10" });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("MIN_ORDER");
    });
    it("charges full price with no code, whatever percentage the browser claims", async () => {
      await post({ ...BASE, discountPercent: 50 });
      expect(inserted("orders")[0]).toMatchObject({ discount_amount: 0, promo_code: null });
    });
  });

  describe("whose customer record an order attaches to", () => {
    const updates = () => (db.calls.customers ?? []).filter((c) => c.method === "update").map((c) => c.args[0] as Record<string, unknown>);
    const inserts = () => (db.calls.customers ?? []).filter((c) => c.method === "insert").map((c) => c.args[0] as Record<string, unknown>);

    it("never builds a filter from the email typed into the form", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "u1", email: "me@example.com" } as never);
      await post({ ...BASE, customer: { ...BASE.customer, email: "x@y.co,id.neq.0" } });
      expect(db.calls.customers?.some((c) => c.method === "or")).toBeFalsy();
    });
    it("uses the signed-in person's own verified email, not whatever the form says", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "u1", email: "me@example.com" } as never);
      db.results.customers = { data: null, error: null };
      await post({ ...BASE, customer: { ...BASE.customer, email: "victim@example.com" } });
      // created for u1's own email (the insert result stub returns an id)
      expect(inserts()[0]).toMatchObject({ user_id: "u1", email: "me@example.com" });
    });
    it("never takes over a customer record that belongs to someone else", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "u1", email: "me@example.com" } as never);
      db.results.customers = { data: { id: "cust-victim", user_id: "someone-else" }, error: null };
      await post(BASE);
      expect(updates().some((u) => "user_id" in u)).toBe(false);
      expect(inserts()[0]).toMatchObject({ user_id: "u1" });
    });
    it("reuses their own record without rewriting who it belongs to", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ id: "u1", email: "me@example.com" } as never);
      db.results.customers = { data: { id: "cust-1", user_id: "u1" }, error: null };
      await post(BASE);
      expect(updates().some((u) => "user_id" in u)).toBe(false);
      expect(inserts()).toHaveLength(0);
    });
    it("a guest can't overwrite a registered customer's details, and gets a record of their own", async () => {
      db.results.customers = { data: { id: "cust-registered", user_id: "someone-else" }, error: null };
      await post(BASE);
      expect(updates()).toHaveLength(0);
      expect(inserts()).toHaveLength(1);
    });
    it("a guest reusing an earlier guest record doesn't rewrite it", async () => {
      db.results.customers = { data: { id: "cust-guest", user_id: null }, error: null };
      await post(BASE);
      expect(updates()).toHaveLength(0);
      expect(inserts()).toHaveLength(0);
    });
  });

  it("only takes prepaid methods, since the webhook is what marks an order paid", async () => {
    for (const method of ["cash", "pay_on_delivery", "", undefined]) {
      const res = await post({ ...BASE, paymentMethod: method });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_PAYMENT_METHOD");
    }
    expect(inserted("orders")).toHaveLength(0);
  });

  it("charges the delivery fee the server knows for the chosen option", async () => {
    await post({ ...BASE, deliveryOption: "express" });
    expect(inserted("orders")[0]).toMatchObject({ delivery_fee: 450000 });
    db.reset();
    db.results.product_variants = { data: [VARIANT], error: null };
    db.results.customers = { data: { id: "c" }, error: null };
    db.results.orders = { data: { id: "o", order_number: "N", status: "pending_payment", subtotal: 0, delivery_fee: 0, discount_amount: 0, total: 0 }, error: null };
    await post({ ...BASE, deliveryOption: "pickup" });
    expect(inserted("orders")[0]).toMatchObject({ delivery_fee: 110000 });
    db.reset();
    db.results.product_variants = { data: [VARIANT], error: null };
    await post({ ...BASE, deliveryOption: "teleport" });
    expect(inserted("orders")).toHaveLength(0);
  });

  it("releases the held stock when the order can't be saved", async () => {
    db.results.orders = { data: null, error: { message: "boom" } };
    const res = await post(BASE);
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalledWith(expect.anything(), [{ variantId: V1, deltaReserved: 2, requireAvailable: 2 }]);
  });

  it("cancels the order and releases stock when its lines can't be saved", async () => {
    db.results.order_items = { data: null, error: { message: "boom" } };
    const res = await post(BASE);
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalled();
    expect(db.calls.orders?.some((c) => c.method === "update")).toBe(true);
  });

  it("never echoes internal error text", async () => {
    db.results.product_variants = { data: null, error: { message: "relation secret_table does not exist" } };
    const res = await post(BASE);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_table/);
  });

  it("still validates contact and address details", async () => {
    expect((await (await post({ ...BASE, customer: { email: "a@b.co" } })).json()).code).toBe("INVALID_CUSTOMER");
    expect((await (await post({ ...BASE, address: { city: "x" } })).json()).code).toBe("INVALID_ADDRESS");
    expect((await (await post({ ...BASE, items: [] })).json()).code).toBe("EMPTY_CART");
  });
});
