import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get("variant_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const serviceClient = createServiceClient();

    let query = serviceClient
      .from("stock_movements")
      .select(`
        id,
        variant_id,
        delta,
        reason,
        order_id,
        actor_id,
        notes,
        created_at,
        actor:users(id, full_name, email, role),
        variant:product_variants(
          id,
          size,
          color,
          sku,
          product:products(id, name, slug, base_price)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (variantId) {
      query = query.eq("variant_id", variantId);
    }

    const { data: movements, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ data: movements || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}
