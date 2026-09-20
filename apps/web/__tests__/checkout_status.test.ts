// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/checkout/status/route";

const REF = "gts_11111111-1111-4111-8111-111111111111";
const status = (ref?: string) => GET(new NextRequest(`http://localhost:3000/api/v1/checkout/status${ref === undefined ? "" : `?reference=${ref}`}`));

const ORDER = {
  order_number: "GTS-202609-000050", status: "paid", subtotal: 3100000, delivery_fee: 150000, discount_amount: 0, total: 3250000,
  created_at: "2026-09-20T10:00:00Z", paid_at: "2026-09-20T10:01:00Z",
  items: [{ quantity: 2, unit_price: 1550000, line_total: 3100000, product_snapshot: { name: "GTS Oxford Shirt", size: "M", color: "Black" } }],
  customer: { email: "secret@example.com", phone: "0801", full_name: "Bola" },
};

beforeEach(() => {
  db.reset();
  db.results.transactions = { data: { order_id: "o1", payment_status: "success" }, error: null };
  db.results.orders = { data: ORDER, error: null };
});

describe("GET /api/v1/checkout/status (has this payment gone through?)", () => {
  it("says paid, with the order and its lines, once the webhook has confirmed it", async () => {
    const res = await status(REF);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ order_number: "GTS-202609-000050", paid: true, total: 3250000, subtotal: 3100000, delivery_fee: 150000, discount_amount: 0 });
    expect(data.items).toEqual([{ name: "GTS Oxford Shirt", size: "M", color: "Black", quantity: 2, unit_price: 1550000, line_total: 3100000 }]);
  });

  it("says not paid yet while the order is still waiting", async () => {
    db.results.orders = { data: { ...ORDER, status: "pending_payment", paid_at: null }, error: null };
    expect((await (await status(REF)).json()).data.paid).toBe(false);
  });

  it("never reveals who the customer is", async () => {
    const text = JSON.stringify(await (await status(REF)).json());
    expect(text).not.toMatch(/secret@example|0801|Bola/);
  });

  it("looks the payment up by an unguessable reference only, and refuses anything else", async () => {
    for (const bad of [undefined, "", "1", "GTS-202609-000050", "gts_x", `${REF}'; drop table orders;--`]) {
      const res = await status(bad);
      expect(res.status).toBe(400);
    }
    expect(db.touched).toHaveLength(0);
  });

  it("gives the same 404 for an unknown reference", async () => {
    db.results.transactions = { data: null, error: null };
    expect((await status(REF)).status).toBe(404);
  });

  it("is never cached and hides internal errors", async () => {
    expect((await status(REF)).headers.get("Cache-Control")).toBe("no-store");
    db.results.transactions = { data: null, error: { message: "relation secret_t missing" } };
    const res = await status(REF);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
});
