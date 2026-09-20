// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/checkout/quote/route";

const V1 = "11111111-1111-4111-8111-111111111111";
const VARIANT = {
  id: V1, size: "M", color: "Black", price_modifier: 50000, is_active: true,
  inventory: { quantity: 3, reserved_quantity: 1 },
  product: { id: "p1", name: "GTS Oxford Shirt", slug: "oxford-shirt", base_price: 1500000, status: "active", primary_image: null },
};
const quote = (body: unknown) => POST(new NextRequest("http://localhost:3000/api/v1/checkout/quote", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  db.reset();
  db.results.product_variants = { data: [VARIANT], error: null };
});

describe("POST /api/v1/checkout/quote (what the cart really costs)", () => {
  it("prices each line from the database, ignoring anything the browser claims", async () => {
    const res = await quote({ items: [{ variant_id: V1, quantity: 2, price: 1, unit_price: 1 }] });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.lines).toEqual([
      expect.objectContaining({ variant_id: V1, name: "GTS Oxford Shirt", size: "M", color: "Black", quantity: 2, unit_price: 1550000, line_total: 3100000, available: 2, in_stock: true }),
    ]);
    expect(data.subtotal).toBe(3100000);
  });

  it("gives the delivery fees the checkout will charge", async () => {
    const { data } = await (await quote({ items: [{ variant_id: V1, quantity: 1 }] })).json();
    expect(data.delivery_fees).toEqual({ door: 150000, pickup: 110000, express: 450000 });
  });

  it("flags a line asking for more than is available, without failing the whole quote", async () => {
    const { data } = await (await quote({ items: [{ variant_id: V1, quantity: 5 }] })).json();
    expect(data.lines[0]).toMatchObject({ available: 2, in_stock: false });
    expect(data.all_available).toBe(false);
  });

  it("lists items that are no longer sold", async () => {
    db.results.product_variants = { data: [{ ...VARIANT, product: { ...VARIANT.product, status: "draft" } }], error: null };
    const res = await quote({ items: [{ variant_id: V1, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ITEM_UNAVAILABLE");
  });

  it("rejects an empty or malformed cart", async () => {
    expect((await quote({ items: [] })).status).toBe(400);
    expect((await quote({ items: [{ quantity: 1 }] })).status).toBe(400);
    const bad = await POST(new NextRequest("http://localhost:3000/api/v1/checkout/quote", { method: "POST", body: "{nope" }));
    expect(bad.status).toBe(400);
  });

  it("is never cached", async () => {
    expect((await quote({ items: [{ variant_id: V1, quantity: 1 }] })).headers.get("Cache-Control")).toBe("no-store");
  });
});
