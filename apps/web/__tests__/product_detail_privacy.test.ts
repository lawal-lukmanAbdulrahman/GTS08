import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

let staff: unknown = null;
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  optionalStaff: vi.fn(async () => staff),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/products/[slug]/route";

const PRODUCT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Standing Fan",
  slug: "standing-fan",
  base_price: 3500000,
  cost_price: 1470000,
  status: "active",
  category: { id: "c", name: "Appliances", slug: "appliances" },
  images: [{ id: "i1", cloudinary_public_id: "https://x/y.webp", is_primary: true, variant_id: null, sort_order: 0 }],
  variants: [{ id: "v1", size: "M", color: "Black", price_modifier: 0, cost_price: 1000, inventory: { quantity: 5, reserved_quantity: 1 } }],
};
const call = (slug = "standing-fan") => GET(new NextRequest(`http://localhost:3000/api/v1/products/${slug}`), { params: Promise.resolve({ slug }) });
const ADMIN = { isAdmin: true, permissions: {}, role: "admin" };
const CASHIER = { isAdmin: false, permissions: { can_process_pos: true }, role: "cashier" };
const INVENTORY = { isAdmin: false, permissions: { can_manage_inventory: true }, role: "inventory_staff" };

describe("GET /products/[slug] keeps cost data private", () => {
  beforeEach(() => {
    db.reset();
    staff = null;
    db.results.products = { data: JSON.parse(JSON.stringify(PRODUCT)), error: null };
    db.results.reviews = { data: [], error: null };
  });

  it("never sends cost_price (top level or on variants) to an anonymous caller", async () => {
    const body = await (await call()).json();
    expect(JSON.stringify(body)).not.toMatch(/cost/i);
    expect(body.data.name).toBe("Standing Fan");
    expect(body.data.variants[0].available).toBe(4);
  });

  it("does not send it to a cashier either", async () => {
    staff = CASHIER;
    expect(JSON.stringify(await (await call()).json())).not.toMatch(/cost/i);
  });

  it("does send it to an admin (the product editor needs it)", async () => {
    staff = ADMIN;
    expect((await (await call()).json()).data.cost_price).toBe(1470000);
  });

  it("and to staff who manage inventory", async () => {
    staff = INVENTORY;
    expect((await (await call()).json()).data.cost_price).toBe(1470000);
  });

  it("only shows active products to the public (drafts are not public)", async () => {
    await call();
    const eqs = db.calls.products!.filter((c) => c.method === "eq").map((c) => c.args.join("="));
    expect(eqs).toContain("status=active");
  });

  it("lets staff open a draft", async () => {
    staff = ADMIN;
    await call();
    const eqs = db.calls.products!.filter((c) => c.method === "eq").map((c) => c.args.join("="));
    expect(eqs).not.toContain("status=active");
  });

  it("still 404s an unknown product", async () => {
    db.results.products = { data: null, error: null };
    expect((await call()).status).toBe(404);
  });
});
