import type { PosProduct } from "./pos-types";

/** Barcode scanners "type" a SKU and press Enter. This is what such text looks like (not a word to search for). */
export function looksLikeSku(text: string): boolean {
  const t = text.trim();
  return /^[A-Za-z0-9._-]{3,64}$/.test(t) && /[0-9-]/.test(t);
}

interface SkuLookup {
  product: { id: string; name: string; slug: string; base_price: number };
  variant: { id: string; size: string | null; color: string | null; color_hex: string | null; sku: string | null; price_modifier: number; quantity: number; available: number };
}

/** The exact variant a scan found, shaped like a search result so the cart can add it. */
export function skuLookupToProduct({ product, variant }: SkuLookup): PosProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    base_price: product.base_price,
    category: null,
    primary_image: null,
    stock_status: variant.available <= 0 ? "out_of_stock" : "in_stock",
    variants: [variant],
  };
}
