import type { NextRequest } from "next/server";
import { requireAdmin } from "../../../_lib/staff-access";
import { analytics } from "../../../_lib/analytics-route";

interface Row {
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  variant: { id: string; size: string | null; color: string | null; product: { name: string; slug: string } | null } | null;
}

/** Variants that are out of stock, and ones at or under their restock level, worst first. */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  return analytics(
    request,
    async ({ client }) => {
      const { data, error } = await client
        .from("inventory")
        .select("quantity, reserved_quantity, low_stock_threshold, variant:product_variants(id, size, color, product:products(name, slug))")
        .limit(5000);
      if (error) throw new Error(error.message);

      const rows = ((data ?? []) as unknown as Row[])
        .filter((r) => r.variant)
        .map((r) => ({
          variant_id: r.variant!.id,
          product: r.variant!.product?.name ?? "Product",
          slug: r.variant!.product?.slug ?? null,
          size: r.variant!.size,
          color: r.variant!.color,
          available: Math.max(0, r.quantity - r.reserved_quantity),
          threshold: r.low_stock_threshold,
        }))
        .sort((a, b) => a.available - b.available);

      return { out_of_stock: rows.filter((r) => r.available === 0), low_stock: rows.filter((r) => r.available > 0 && r.available <= r.threshold) };
    },
    { needsPeriod: false }
  );
}
