import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../_lib/http";
import { getOrComputeCached } from "../../_lib/storefront-cache";

/**
 * GET /api/v1/storefront/trending
 * High-performance, SWR-cached endpoint returning products exhibiting the highest recent engagement momentum.
 *
 * Cache Strategy:
 * - 3 minutes fresh cache (sub-millisecond instant response)
 * - 10 minutes SWR (stale-while-revalidate): serves instantly while refreshing in the background
 * - Parallelized database queries with Promise.all
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 100);

    const masterTrending = await getOrComputeCached(
      "storefront:trending:master_pool",
      180, // fresh for 3 minutes
      async () => {
        const supabase = createServiceClient();
        const now = Date.now();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Parallelize all queries concurrently for ultra-fast database roundtrip
        const [viewsRes, wishlistsRes, searchesRes, productsRes] = await Promise.all([
          supabase
            .from("product_views")
            .select("product_id, event_type, duration_seconds, scroll_depth, created_at")
            .gte("created_at", fourteenDaysAgo),
          supabase
            .from("wishlists")
            .select("product_id, added_at")
            .gte("added_at", fourteenDaysAgo),
          supabase
            .from("search_queries")
            .select("query")
            .gte("created_at", fourteenDaysAgo)
            .limit(100),
          supabase
            .from("products")
            .select(`
              id, name, slug, sku, brand, sub_category, has_transparent_bg, short_description, description,
              base_price, compare_at_price, average_rating, review_count, tags, total_sold,
              category:categories(id, name, slug, parent:parent_id(id, name, slug)),
              images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id),
              variants:product_variants(id, size, color, color_hex, is_active)
            `)
            .eq("status", "active")
            .limit(150),
        ]);

        const allProducts = productsRes.data ?? [];
        if (allProducts.length === 0) return { data: [], source: "empty" };

        const views = viewsRes.data ?? [];
        const wishlists = wishlistsRes.data ?? [];
        const searches = searchesRes.data ?? [];

        // Identify top 2 pure bestsellers to prevent duplicate duplicate line-up
        const topBestsellerIds = new Set(
          [...allProducts]
            .sort((a, b) => Number(b.total_sold ?? 0) - Number(a.total_sold ?? 0))
            .slice(0, 2)
            .map((p) => p.id)
        );

        // Build engagement score map
        const scores = new Map<string, number>();

        // Process views, dwell times, and detail readings
        for (const v of views) {
          const createdAt = new Date(v.created_at).getTime();
          const recencyBoost =
            createdAt >= Date.parse(threeDaysAgo) ? 1.5 : createdAt >= Date.parse(sevenDaysAgo) ? 1.2 : 1.0;

          let eventPoints = 1.0;
          const duration = Number(v.duration_seconds || 0);

          if (v.event_type === "read_details" || duration >= 25 || (v.scroll_depth && v.scroll_depth >= 50)) {
            eventPoints = 5.0;
          } else if (duration >= 10) {
            eventPoints = 3.0;
          } else if (v.event_type === "click") {
            eventPoints = 2.0;
          } else if (v.event_type === "cart_add") {
            eventPoints = 6.0;
          } else if (v.event_type === "wishlist_add") {
            eventPoints = 5.0;
          }

          const totalSignal = eventPoints * recencyBoost;
          scores.set(v.product_id, (scores.get(v.product_id) ?? 0) + totalSignal);
        }

        // Process wishlist saves
        for (const w of wishlists) {
          const addedAt = new Date(w.added_at).getTime();
          const recencyBoost = addedAt >= Date.parse(threeDaysAgo) ? 1.5 : 1.0;
          scores.set(w.product_id, (scores.get(w.product_id) ?? 0) + 5.0 * recencyBoost);
        }

        // Match search query keywords with product titles and tags
        const searchTerms = searches
          .map((s) => s.query.toLowerCase().trim())
          .filter((q) => q.length >= 3);

        if (searchTerms.length > 0) {
          for (const p of allProducts) {
            const titleLower = p.name.toLowerCase();
            const brandLower = (p.brand || "").toLowerCase();
            let matchCount = 0;
            for (const term of searchTerms) {
              if (titleLower.includes(term) || brandLower.includes(term)) {
                matchCount++;
              }
            }
            if (matchCount > 0) {
              scores.set(p.id, (scores.get(p.id) ?? 0) + Math.min(matchCount * 2.5, 15));
            }
          }
        }

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

        // If engagement events exist:
        if (scores.size >= 3) {
          const scoredProducts = allProducts.map((p) => ({
            product: p,
            score: scores.get(p.id) ?? 0,
          }));

          scoredProducts.sort((a, b) => b.score - a.score);

          const trendingList = scoredProducts
            .filter((s) => s.score > 0)
            .map((s) => s.product);

          return {
            data: trendingList.map(formatProduct),
            source: "engagement_momentum",
          };
        }

        // Cold Start / Sparse Engagement Fallback
        const coldScored = allProducts
          .filter((p) => !topBestsellerIds.has(p.id))
          .map((p) => {
            const rating = Number(p.average_rating ?? 4.5);
            const reviews = Number(p.review_count ?? 10);
            const discount =
              p.compare_at_price && p.compare_at_price > p.base_price
                ? ((p.compare_at_price - p.base_price) / p.compare_at_price) * 100
                : 0;

            const coldScore = rating * 8 + Math.min(reviews, 50) * 0.4 + discount * 0.2;
            return { product: p, score: coldScore };
          });

        coldScored.sort((a, b) => b.score - a.score);

        return {
          data: coldScored.map((s) => s.product).map(formatProduct),
          source: "curated_acclaim",
        };
      },
      600 // 10 minutes stale-while-revalidate window
    );

    return NextResponse.json(
      {
        success: true,
        data: (masterTrending.data || []).slice(0, limit),
        source: masterTrending.source,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return serverError(err);
  }
}
