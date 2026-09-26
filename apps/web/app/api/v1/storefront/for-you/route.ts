import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";
import { getOrComputeCached } from "../../_lib/storefront-cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/storefront/for-you
 * Personalizes suggestions using SWR cache:
 * 1. Saved / Wishlisted products
 * 2. Products the user spent high dwell time looking at or reading details
 * 3. Recent search queries
 * 4. Works for both authenticated accounts AND anonymous sessions (via ?session_id=)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 100);
    const sessionId = searchParams.get("session_id") || request.headers.get("x-session-id");

    const user = await getAuthenticatedUser(request);
    const cacheKey = `storefront:foryou:${user?.id || sessionId || "anon"}`;

    const result = await getOrComputeCached(
      cacheKey,
      120, // 2 minutes fresh
      async () => {
        const supabase = createServiceClient();

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

        const interactedProductIds = new Set<string>();
        const excludeProductIds = new Set<string>();
        const targetCategories = new Set<string>();
        const targetBrands = new Set<string>();
        const searchTerms: string[] = [];

        // 1. Fetch Wishlist Saves
        const wishlistPromise = user?.id
          ? supabase
              .from("wishlists")
              .select("product_id, products:product_id(category_id, brand)")
              .eq("user_id", user.id)
              .limit(30)
          : Promise.resolve({ data: null });

        // 2. Fetch Deep Engagement (dwell time & reading details)
        let viewsQuery: any = null;
        if (user?.id && sessionId && UUID_RE.test(sessionId)) {
          viewsQuery = supabase
            .from("product_views")
            .select("product_id, duration_seconds, event_type, products:product_id(category_id, brand)")
            .or(`user_id.eq.${user.id},session_id.eq.${sessionId}`)
            .order("created_at", { ascending: false })
            .limit(30);
        } else if (user?.id) {
          viewsQuery = supabase
            .from("product_views")
            .select("product_id, duration_seconds, event_type, products:product_id(category_id, brand)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30);
        } else if (sessionId && UUID_RE.test(sessionId)) {
          viewsQuery = supabase
            .from("product_views")
            .select("product_id, duration_seconds, event_type, products:product_id(category_id, brand)")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(30);
        }

        // 3. Fetch Recent Search Queries
        let searchQuery: any = null;
        if (user?.id && sessionId && UUID_RE.test(sessionId)) {
          searchQuery = supabase
            .from("search_queries")
            .select("query")
            .or(`user_id.eq.${user.id},session_id.eq.${sessionId}`)
            .order("created_at", { ascending: false })
            .limit(10);
        } else if (user?.id) {
          searchQuery = supabase
            .from("search_queries")
            .select("query")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);
        } else if (sessionId && UUID_RE.test(sessionId)) {
          searchQuery = supabase
            .from("search_queries")
            .select("query")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(10);
        }

        // Run signals queries concurrently
        const [userWishlistRes, deepViewsRes, queryRowsRes] = await Promise.all([
          wishlistPromise,
          viewsQuery ? viewsQuery : Promise.resolve({ data: null }),
          searchQuery ? searchQuery : Promise.resolve({ data: null }),
        ]);

        for (const item of userWishlistRes.data ?? []) {
          excludeProductIds.add(item.product_id);
          interactedProductIds.add(item.product_id);
          const prod = item.products as any;
          if (prod?.category_id) targetCategories.add(prod.category_id);
          if (prod?.brand) targetBrands.add(prod.brand.toLowerCase());
        }

        for (const v of deepViewsRes.data ?? []) {
          interactedProductIds.add(v.product_id);
          const prod = v.products as any;
          if (prod?.category_id) targetCategories.add(prod.category_id);
          if (prod?.brand) targetBrands.add(prod.brand.toLowerCase());
        }

        for (const q of queryRowsRes.data ?? []) {
          if (q.query && q.query.trim().length >= 2) {
            searchTerms.push(q.query.toLowerCase().trim());
          }
        }

        const hasSignals = targetCategories.size > 0 || searchTerms.length > 0 || targetBrands.size > 0;

        // Personalized Recommendations Branch
        if (hasSignals) {
          let candidateQuery = supabase
            .from("products")
            .select(`
              id, name, slug, sku, brand, sub_category, has_transparent_bg, short_description, description,
              base_price, compare_at_price, average_rating, review_count, tags, total_sold, category_id,
              category:categories(id, name, slug, parent:parent_id(id, name, slug)),
              images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id),
              variants:product_variants(id, size, color, color_hex, is_active)
            `)
            .eq("status", "active")
            .limit(80);

          if (targetCategories.size > 0) {
            candidateQuery = candidateQuery.in("category_id", [...targetCategories]);
          }

          const { data: candidates } = await candidateQuery;
          let availableCandidates = (candidates ?? []).filter((p) => !excludeProductIds.has(p.id));

          if (availableCandidates.length < 50) {
            const { data: extras } = await supabase
              .from("products")
              .select(`
                id, name, slug, sku, brand, sub_category, has_transparent_bg, short_description, description,
                base_price, compare_at_price, average_rating, review_count, tags, total_sold, category_id,
                category:categories(id, name, slug, parent:parent_id(id, name, slug)),
                images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id),
                variants:product_variants(id, size, color, color_hex, is_active)
              `)
              .eq("status", "active")
              .order("average_rating", { ascending: false })
              .limit(50);

            const existingIds = new Set(availableCandidates.map((c) => c.id));
            for (const extra of extras ?? []) {
              if (!existingIds.has(extra.id) && !excludeProductIds.has(extra.id)) {
                availableCandidates.push(extra);
              }
            }
          }

          const scored = availableCandidates.map((p) => {
            let score = 0;
            const brand = (p.brand || "").toLowerCase();
            const name = (p.name || "").toLowerCase();

            if (p.category_id && targetCategories.has(p.category_id)) {
              score += 15;
            }

            if (brand && targetBrands.has(brand)) {
              score += 8;
            }

            for (const term of searchTerms) {
              if (name.includes(term)) score += 12;
              if (brand.includes(term)) score += 8;
            }

            score += Number(p.average_rating ?? 4) * 2;
            if (p.compare_at_price && p.compare_at_price > p.base_price) {
              score += 4;
            }

            return { product: p, score };
          });

          scored.sort((a, b) => b.score - a.score);

          return {
            data: scored.map((s) => s.product).map(formatProduct),
            source: "personalized",
          };
        }

        // Cold / First-Time Discovery Fallback
        const { data: discovery } = await supabase
          .from("products")
          .select(`
            id, name, slug, sku, brand, sub_category, has_transparent_bg, short_description, description,
            base_price, compare_at_price, average_rating, review_count, tags, total_sold,
            category:categories(id, name, slug, parent:parent_id(id, name, slug)),
            images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id),
            variants:product_variants(id, size, color, color_hex, is_active)
          `)
          .eq("status", "active")
          .order("average_rating", { ascending: false })
          .limit(80);

        return {
          data: (discovery ?? []).map(formatProduct),
          source: "shopper_favorites",
        };
      },
      300 // 5 minutes SWR window
    );

    return NextResponse.json(
      {
        success: true,
        data: (result.data || []).slice(0, limit),
        source: result.source,
      },
      {
        headers: {
          "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    return serverError(err);
  }
}
