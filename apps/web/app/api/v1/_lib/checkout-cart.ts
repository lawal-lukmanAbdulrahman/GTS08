import { isUuid, validateOrderItems, type OrderItem } from "@gts/utils";

// The service client is untyped across this codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CartClient = { from(table: string): any };

export type ResolveResult =
  | { ok: true; items: OrderItem[] }
  | { ok: false; code: "INVALID_ITEMS" | "ITEM_UNAVAILABLE" | "DATABASE_ERROR"; message: string; details?: Record<string, unknown> };

/** Delivery fees in kobo. The browser only chooses an option; the server owns the price. */
export const DELIVERY_FEE_KOBO: Record<string, number> = {
  door: 150_000,
  pickup: 110_000,
  express: 450_000,
};

interface VariantRow {
  id: string;
  size: string | null;
  color: string | null;
  is_active: boolean;
}

interface ProductRow {
  slug: string;
  status: string;
  variants: VariantRow[] | null;
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const invalid = (message: string): ResolveResult => ({ ok: false, code: "INVALID_ITEMS", message });
const unavailable = (label: string): ResolveResult => ({
  ok: false,
  code: "ITEM_UNAVAILABLE",
  message: `${label} is no longer available in that size or colour. Please choose again.`,
});

/**
 * A cart line names what to buy either by variant id or by product slug plus
 * the size and colour picked. This turns every line into a real variant id
 * (never guessing between several), and hands back the merged list. Prices are
 * not read here and never come from the cart.
 */
export async function resolveCartLines(client: CartClient, raw: unknown): Promise<ResolveResult> {
  if (!Array.isArray(raw)) return invalid("items must be a list.");

  const direct: unknown[] = [];
  const bySlug: Array<{ slug: string; size: unknown; color: unknown; quantity: number }> = [];

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i] as Record<string, unknown> | null;
    const n = i + 1;
    if (typeof line !== "object" || line === null) return invalid(`Item ${n} is not valid.`);
    const q = line.quantity;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1) return invalid(`Item ${n} needs a whole quantity of 1 or more.`);
    if (isUuid(line.variant_id)) {
      direct.push({ variant_id: line.variant_id, quantity: q });
    } else if (typeof line.product_slug === "string" && line.product_slug.trim()) {
      bySlug.push({ slug: line.product_slug.trim(), size: line.size, color: line.color, quantity: q });
    } else {
      return invalid(`Item ${n} doesn't say which product it is.`);
    }
  }

  const resolved: unknown[] = [...direct];

  if (bySlug.length > 0) {
    const slugs = [...new Set(bySlug.map((l) => l.slug))];
    const { data, error } = await client
      .from("products")
      .select("slug, status, variants:product_variants(id, size, color, is_active)")
      .in("slug", slugs);
    if (error) return { ok: false, code: "DATABASE_ERROR", message: "We couldn't check your cart. Please try again." };

    const products = new Map(((data || []) as ProductRow[]).map((p) => [p.slug, p]));

    for (const line of bySlug) {
      const product = products.get(line.slug);
      if (!product || product.status !== "active") return unavailable("An item in your cart");
      let candidates = (product.variants ?? []).filter((v) => v.is_active);
      if (candidates.length === 0) return unavailable("An item in your cart");

      if (candidates.length > 1) {
        if (norm(line.size)) candidates = candidates.filter((v) => norm(v.size) === norm(line.size));
        if (candidates.length > 1 && norm(line.color)) {
          const wanted = norm(line.color);
          const exact = candidates.filter((v) => norm(v.color) === wanted);
          // The cart may carry a short name ("blue") for a full one ("University Blue"): accept it only if exactly one fits.
          const partial = candidates.filter((v) => {
            const have = norm(v.color);
            return have && wanted.length >= 3 && (have.includes(wanted) || wanted.includes(have));
          });
          if (exact.length > 0) candidates = exact;
          else if (partial.length === 1) candidates = partial;
        }
        if (candidates.length !== 1) return unavailable("An item in your cart");
      }
      resolved.push({ variant_id: candidates[0]!.id, quantity: line.quantity });
    }
  }

  const merged = validateOrderItems(resolved);
  if (!merged.ok) return invalid(merged.message);
  return { ok: true, items: merged.items };
}
