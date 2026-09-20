import { describe, it, expect } from "vitest";
import { reconcileCartStock } from "./cart-stock";
import type { CartLine, PosProduct } from "./pos-types";

const line = (variantId: string, quantity: number, available: number, productName = "Shirt"): CartLine => ({
  variantId, productId: "p", productName, size: "M", color: "Black", unitPrice: 100, quantity, available,
});
const product = (variants: Array<{ id: string; available: number }>): PosProduct => ({
  id: "p", name: "Shirt", slug: "shirt", base_price: 100, category: null, primary_image: null, stock_status: "in_stock",
  variants: variants.map((v) => ({ id: v.id, size: "M", color: "Black", color_hex: null, sku: null, price_modifier: 0, quantity: v.available, available: v.available })),
});

describe("reconcileCartStock (the till follows stock that changes while a sale is open)", () => {
  it("leaves the cart alone when nothing changed", () => {
    const cart = [line("v1", 2, 5)];
    const out = reconcileCartStock(cart, [product([{ id: "v1", available: 5 }])]);
    expect(out.lines).toBe(cart);
    expect(out.notices).toEqual([]);
  });

  it("raises the ceiling when stock arrives, without touching the quantity", () => {
    const out = reconcileCartStock([line("v1", 2, 2)], [product([{ id: "v1", available: 9 }])]);
    expect(out.lines[0]).toMatchObject({ quantity: 2, available: 9 });
    expect(out.notices).toEqual([]);
  });

  it("reduces the quantity to what's left, and says so", () => {
    const out = reconcileCartStock([line("v1", 4, 5, "Oxford Shirt")], [product([{ id: "v1", available: 2 }])]);
    expect(out.lines[0]).toMatchObject({ quantity: 2, available: 2 });
    expect(out.notices).toEqual(["Oxford Shirt (M / Black): only 2 left, so the quantity was lowered to 2."]);
  });

  it("removes a line that just sold out, and says so", () => {
    const out = reconcileCartStock([line("v1", 1, 3, "Oxford Shirt"), line("v2", 1, 3)], [product([{ id: "v1", available: 0 }, { id: "v2", available: 3 }])]);
    expect(out.lines.map((l) => l.variantId)).toEqual(["v2"]);
    expect(out.notices).toEqual(["Oxford Shirt (M / Black) just sold out and was removed from this sale."]);
  });

  it("ignores lines whose product isn't in the refreshed list (it may be on another page)", () => {
    const cart = [line("v9", 3, 4)];
    const out = reconcileCartStock(cart, [product([{ id: "v1", available: 1 }])]);
    expect(out.lines).toBe(cart);
  });
});
