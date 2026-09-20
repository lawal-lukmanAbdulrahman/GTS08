import { describe, it, expect } from "vitest";
import { resolveQuickAddVariant } from "./quick-add";
import type { PosProduct } from "./pos-types";

const baseProduct: Omit<PosProduct, "variants"> = {
  id: "p1",
  name: "Plain Tee",
  slug: "plain-tee",
  base_price: 800000,
  category: null,
  primary_image: null,
  stock_status: "in_stock",
};

describe("resolveQuickAddVariant (spec Part 3.3: tap-to-add for single-variant products)", () => {
  it("returns the sole variant when a product has exactly one", () => {
    const product: PosProduct = {
      ...baseProduct,
      variants: [{ id: "v1", size: null, color: null, color_hex: null, sku: "T-1", price_modifier: 0, quantity: 5, available: 5 }],
    };
    expect(resolveQuickAddVariant(product)).toBe("v1");
  });

  it("returns null when a product has multiple variants (opens the modal instead)", () => {
    const product: PosProduct = {
      ...baseProduct,
      variants: [
        { id: "v1", size: "S", color: null, color_hex: null, sku: "T-S", price_modifier: 0, quantity: 5, available: 5 },
        { id: "v2", size: "M", color: null, color_hex: null, sku: "T-M", price_modifier: 0, quantity: 5, available: 5 },
      ],
    };
    expect(resolveQuickAddVariant(product)).toBeNull();
  });

  it("returns null when the sole variant is out of stock", () => {
    const product: PosProduct = {
      ...baseProduct,
      variants: [{ id: "v1", size: null, color: null, color_hex: null, sku: "T-1", price_modifier: 0, quantity: 0, available: 0 }],
    };
    expect(resolveQuickAddVariant(product)).toBeNull();
  });

  it("returns null for a product with no variants", () => {
    expect(resolveQuickAddVariant({ ...baseProduct, variants: [] })).toBeNull();
  });
});
