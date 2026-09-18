import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../_lib/access";
import { variantAvailable, type InventoryRow } from "../../_lib/stock-status";

/**
 * Barcode scanner support (gts_03_cashier_spec.md Part 7): exact SKU match
 * pre-identifies the variant for the Variant Selector Modal.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ sku: string }> }) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { sku } = await context.params;
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("product_variants")
    .select(
      `
      id, size, color, color_hex, sku, price_modifier,
      inventory(quantity, reserved_quantity, low_stock_threshold),
      product:products(id, name, slug, base_price)
      `
    )
    .eq("sku", sku)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: `No product found for SKU: ${sku}`, code: "SKU_NOT_FOUND" },
      { status: 404 }
    );
  }

  const row = data as unknown as {
    id: string;
    size: string | null;
    color: string | null;
    color_hex: string | null;
    sku: string | null;
    price_modifier: number;
    inventory: InventoryRow | null;
    product: { id: string; name: string; slug: string; base_price: number };
  };

  return NextResponse.json({
    data: {
      product: row.product,
      variant: {
        id: row.id,
        size: row.size,
        color: row.color,
        color_hex: row.color_hex,
        sku: row.sku,
        price_modifier: row.price_modifier,
        quantity: row.inventory?.quantity ?? 0,
        available: row.inventory ? variantAvailable(row.inventory) : 0,
      },
    },
  });
}
