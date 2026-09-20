// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveCartLines, type CartClient } from "../app/api/v1/_lib/checkout-cart";

const V = (id: string, size: string | null, color: string | null, extra: Record<string, unknown> = {}) => ({ id, size, color, is_active: true, ...extra });
const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function client(productsBySlug: Record<string, Array<ReturnType<typeof V>>>): CartClient {
  return {
    from: () => {
      const stub: any = {
        select: () => stub,
        in: (_col: string, slugs: string[]) => Promise.resolve({ data: slugs.filter((s) => productsBySlug[s]).map((s) => ({ slug: s, status: "active", variants: productsBySlug[s] })), error: null }),
      };
      return stub;
    },
  };
}

describe("resolveCartLines (turns what the cart says into real variant ids)", () => {
  const shop = client({
    shirt: [V(U(1), "S", "Blue"), V(U(2), "M", "Blue"), V(U(3), "L", "Blue")],
    fan: [V(U(4), "18 inch", "Industrial Black")],
    fridge: [V(U(5), "24 cu. ft.", "Matte Black"), V(U(6), "24 cu. ft.", "Tuscan Bronze")],
    spa: [V(U(7), null, null)],
  });

  it("passes real variant ids straight through", async () => {
    expect(await resolveCartLines(shop, [{ variant_id: U(9), quantity: 2 }])).toEqual({ ok: true, items: [{ variant_id: U(9), quantity: 2 }] });
  });

  it("finds the variant by product slug and size, ignoring case and spacing", async () => {
    const out = await resolveCartLines(shop, [{ product_slug: "shirt", size: " m ", color: "blue", quantity: 1 }]);
    expect(out).toEqual({ ok: true, items: [{ variant_id: U(2), quantity: 1 }] });
  });

  it("uses the only variant when a product has just one, whatever size or colour the cart names", async () => {
    expect(await resolveCartLines(shop, [{ product_slug: "fan", size: "Standard", color: "black", quantity: 1 }])).toMatchObject({ ok: true, items: [{ variant_id: U(4) }] });
    expect(await resolveCartLines(shop, [{ product_slug: "spa", quantity: 3 }])).toMatchObject({ ok: true, items: [{ variant_id: U(7), quantity: 3 }] });
  });

  it("picks the colour when a size comes in more than one", async () => {
    const out = await resolveCartLines(shop, [{ product_slug: "fridge", size: "24 cu. ft.", color: "Tuscan Bronze", quantity: 1 }]);
    expect(out).toMatchObject({ ok: true, items: [{ variant_id: U(6) }] });
  });

  it("matches a short colour name to the full one when only one fits (blue -> University Blue)", async () => {
    const shoes = client({ jordan: [V(U(1), "42", "University Blue"), V(U(2), "42", "Brown"), V(U(3), "42", "Forest Green")] });
    expect(await resolveCartLines(shoes, [{ product_slug: "jordan", size: "42", color: "blue", quantity: 1 }])).toMatchObject({ ok: true, items: [{ variant_id: U(1) }] });
    expect(await resolveCartLines(shoes, [{ product_slug: "jordan", size: "42", color: "e", quantity: 1 }])).toMatchObject({ ok: false });
  });

  it("refuses to guess when the choice is ambiguous or matches nothing", async () => {
    expect(await resolveCartLines(shop, [{ product_slug: "shirt", size: "XXL", quantity: 1 }])).toMatchObject({ ok: false, code: "ITEM_UNAVAILABLE" });
    expect(await resolveCartLines(shop, [{ product_slug: "shirt", quantity: 1 }])).toMatchObject({ ok: false, code: "ITEM_UNAVAILABLE" });
    expect(await resolveCartLines(shop, [{ product_slug: "fridge", size: "24 cu. ft.", quantity: 1 }])).toMatchObject({ ok: false, code: "ITEM_UNAVAILABLE" });
  });

  it("refuses an unknown product, a draft, or an inactive variant", async () => {
    expect(await resolveCartLines(shop, [{ product_slug: "ghost", quantity: 1 }])).toMatchObject({ ok: false, code: "ITEM_UNAVAILABLE" });
    const drafts = client({ shirt: [V(U(1), "S", "Blue", { is_active: false })] });
    expect(await resolveCartLines(drafts, [{ product_slug: "shirt", size: "S", quantity: 1 }])).toMatchObject({ ok: false, code: "ITEM_UNAVAILABLE" });
  });

  it("merges repeated lines and rejects bad quantities", async () => {
    const out = await resolveCartLines(shop, [
      { product_slug: "shirt", size: "M", quantity: 1 },
      { product_slug: "shirt", size: "M", quantity: 2 },
    ]);
    expect(out).toEqual({ ok: true, items: [{ variant_id: U(2), quantity: 3 }] });
    for (const quantity of [0, -1, 1.5, "2", null]) {
      expect(await resolveCartLines(shop, [{ product_slug: "shirt", size: "M", quantity }])).toMatchObject({ ok: false, code: "INVALID_ITEMS" });
    }
  });

  it("rejects lines that name neither a variant nor a product, and non-strings", async () => {
    expect(await resolveCartLines(shop, [{ quantity: 1 }])).toMatchObject({ ok: false, code: "INVALID_ITEMS" });
    expect(await resolveCartLines(shop, [{ product_slug: 42, quantity: 1 }])).toMatchObject({ ok: false, code: "INVALID_ITEMS" });
    expect(await resolveCartLines(shop, ["nope"])).toMatchObject({ ok: false, code: "INVALID_ITEMS" });
  });

  it("reports a database failure without leaking its message", async () => {
    const broken: CartClient = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: "secret table missing" } }) }) }) } as never;
    const out = await resolveCartLines(broken, [{ product_slug: "shirt", size: "M", quantity: 1 }]);
    expect(out).toMatchObject({ ok: false, code: "DATABASE_ERROR" });
    expect(JSON.stringify(out)).not.toMatch(/secret/);
  });
});
