import type { PosProduct } from "./pos-types";

/**
 * gts_03_cashier_spec.md Part 3.3: "If product has only one size and no
 * color variants: immediately add 1 unit to cart." Returns the variant id to
 * add, or null when the Variant Selector Modal should open instead.
 */
export function resolveQuickAddVariant(product: PosProduct): string | null {
  if (product.variants.length !== 1) return null;
  const only = product.variants[0]!;
  if (only.available <= 0) return null;
  return only.id;
}
