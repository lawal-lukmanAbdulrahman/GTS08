import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient, getRequestDataMode } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { serverError, dbError } from "../../_lib/http";

import { getOrComputeCached, invalidateCache } from "../../_lib/storefront-cache";
import { publicCache } from "../../_lib/public-cache";

/**
 * GET /api/v1/storefront/hero
 * Public: returns the hero carousel products with their product details.
 */
export async function GET() {
  try {
    const dataMode = await getRequestDataMode();
    const isTest = dataMode === "test";

    const data = await getOrComputeCached(
      `storefront:hero:active_${dataMode}`,
      600, // 10 minutes
      async () => {
        const supabase = createServiceClient();
        const { data: heroRows, error } = await supabase
          .from("hero_carousel")
          .select(`
            id, product_id, sort_order, is_active,
            product:products!hero_carousel_product_id_fkey(
              id, name, slug, base_price, compare_at_price, average_rating, review_count, tags, has_transparent_bg, brand, short_description,
              category:categories(id, name, slug, parent:parent_id(id, name, slug)),
              images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id),
              variants:product_variants(id, size, color, color_hex, is_active)
            )
          `)
          .eq("is_active", true)
          .eq("is_test", isTest)
          .order("sort_order", { ascending: true });

        if (error) throw error;
        return heroRows ?? [];
      },
      1800
    );

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": isTest
            ? "private, no-store"
            : await publicCache("public, s-maxage=300, stale-while-revalidate=1200"),
        },
      }
    );
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/v1/storefront/hero
 * Admin-only: set which products appear in the hero carousel.
 * Body: { products: [{ product_id: string, sort_order: number }] }
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const { products } = body as { products?: unknown };
    if (!Array.isArray(products) || products.length > 20) {
      return NextResponse.json({ success: false, error: "products array required (max 20)." }, { status: 400 });
    }

    const dataMode = await getRequestDataMode();
    const isTest = dataMode === "test";
    const supabase = createServiceClient();

    // Clear existing entries for this mode
    const { error: delErr } = await supabase.from("hero_carousel").delete().eq("is_test", isTest);
    if (delErr) return dbError(delErr);

    // Insert new entries
    if (products.length > 0) {
      const rows = products.map((p: any, i: number) => ({
        product_id: p.product_id,
        sort_order: p.sort_order ?? i,
        is_active: p.is_active !== false,
        is_test: isTest,
      }));

      const { error: insErr } = await supabase.from("hero_carousel").insert(rows);
      if (insErr) return dbError(insErr);
    }

    invalidateCache(`storefront:hero:active_${dataMode}`);
    invalidateCache("storefront:hero:active");
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
