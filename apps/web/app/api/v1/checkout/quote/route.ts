import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { DELIVERY_FEE_KOBO, resolveCartLines } from "../../_lib/checkout-cart";
import { variantAvailable } from "../../pos/_lib/stock-status";
import { serverError } from "../../_lib/http";

interface VariantRow {
  id: string;
  size: string | null;
  color: string | null;
  price_modifier: number;
  is_active: boolean;
  inventory: { quantity: number; reserved_quantity: number } | null;
  product: { id: string; name: string; slug: string; base_price: number; status: string; primary_image?: unknown } | null;
}

/**
 * What the cart really costs and whether it's in stock, so the checkout page
 * shows the server's numbers rather than its own. Read-only: nothing is held.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { items?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty.", code: "EMPTY_CART" }, { status: 400 });
    }

    const client = createServiceClient();
    const resolved = await resolveCartLines(client, body.items);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.code === "DATABASE_ERROR" ? 500 : 400 });
    }

    const { data, error } = await client
      .from("product_variants")
      .select("id, size, color, price_modifier, is_active, inventory(quantity, reserved_quantity), product:products(id, name, slug, base_price, status)")
      .in("id", resolved.items.map((i) => i.variant_id));
    if (error) return serverError(new Error(error.message));

    const byId = new Map(((data || []) as unknown as VariantRow[]).map((v) => [v.id, v]));
    const gone = resolved.items.filter((i) => {
      const v = byId.get(i.variant_id);
      return !v || !v.is_active || !v.product || v.product.status !== "active";
    });
    if (gone.length > 0) {
      return NextResponse.json(
        { error: "Some items in your cart are no longer available.", code: "ITEM_UNAVAILABLE", details: { variant_ids: gone.map((i) => i.variant_id) } },
        { status: 400 }
      );
    }

    let subtotal = 0;
    const lines = resolved.items.map((i) => {
      const v = byId.get(i.variant_id)!;
      const unitPrice = v.product!.base_price + v.price_modifier;
      const available = v.inventory ? variantAvailable(v.inventory) : 0;
      subtotal += unitPrice * i.quantity;
      return {
        variant_id: v.id,
        product_slug: v.product!.slug,
        name: v.product!.name,
        size: v.size,
        color: v.color,
        quantity: i.quantity,
        unit_price: unitPrice,
        line_total: unitPrice * i.quantity,
        available,
        in_stock: available >= i.quantity,
      };
    });

    return NextResponse.json(
      { data: { lines, subtotal, delivery_fees: DELIVERY_FEE_KOBO, all_available: lines.every((l) => l.in_stock) } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError(err);
  }
}
