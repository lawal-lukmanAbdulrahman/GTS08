import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../_lib/http";
import { getOrComputeCached } from "../../_lib/storefront-cache";

/**
 * GET /api/v1/storefront/bestselling
 * High-performance, SWR-cached endpoint returning products that are being sold more across all fronts (POS + online storefront),
 * with a mixture of the most saved / wishlisted pieces.
 *
 * Scoring:
 * Score = (total_sold × 1.5) + (wishlist_saves × 2.0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 100);

    const masterBestselling = await getOrComputeCached(
      "storefront:bestselling:master_pool",
      300, // fresh for 5 minutes
      async () => {
        const supabase = createServiceClient();

        // 1. Fetch top candidate active products by total_sold
        const { data: products, error } = await supabase
          .from("products")
          .select(`
            id, name, slug, sku, brand, sub_category, has_transparent_bg, short_description, description,
            base_price, compare_at_price, average_rating, review_count, tags, total_sold,
            category:categories(id, name, slug, parent:parent_id(id, name, slug)),
            images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id),
            variants:product_variants(id, size, color, color_hex, is_active)
          `)
          .eq("status", "active")
          .order("total_sold", { ascending: false })
          .limit(150);

        if (error) {
          console.error("[api] bestselling fetch error:", error.message);
          throw error;
        }

        if (!products || products.length === 0) {
          return { data: [] };
        }

        // 2. Fetch all-time wishlist save counts for these products
        const productIds = products.map((p) => p.id);
        const { data: wishlists } = await supabase
          .from("wishlists")
          .select("product_id")
          .in("product_id", productIds);

        const wishlistCounts = new Map<string, number>();
        for (const w of wishlists ?? []) {
          wishlistCounts.set(w.product_id, (wishlistCounts.get(w.product_id) ?? 0) + 1);
        }

        // 3. Compute hybrid Bestselling score: sales (all fronts) + wishlist interest
        const scored = products.map((p) => {
          const sales = Number(p.total_sold ?? 0);
          const saves = wishlistCounts.get(p.id) ?? 0;
          const score = sales * 1.5 + saves * 2.0;
          return { product: p, score };
        });

        // 4. Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        function formatProduct(p: any) {
          if (!p) return null;
          const primaryImg = p.images?.find((img: any) => img.is_primary) || p.images?.[0];
          return {
            ...p,
            primary_image: primaryImg
              ? {
                  cloudinary_id: primaryImg.cloudinary_public_id,
                  alt: primaryImg.alt_text || p.name,
                }
              : null,
            images: (p.images || []).map((img: any) => ({
              id: img.id,
              cloudinary_id: img.cloudinary_public_id,
              alt: img.alt_text,
              is_primary: img.is_primary,
              sort_order: img.sort_order || 0,
              variant_id: img.variant_id,
            })),
          };
        }

        return {
          data: scored.map((s) => s.product).map(formatProduct),
        };
      },
      900 // 15 minutes stale-while-revalidate window
    );

    return NextResponse.json(
      {
        success: true,
        data: (masterBestselling.data || []).slice(0, limit),
        source: "sales_and_saves_hybrid",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (err) {
    return serverError(err);
  }
}
