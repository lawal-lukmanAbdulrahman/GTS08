import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";
import { getOrComputeCached } from "../../_lib/storefront-cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ScoredProduct {
  product: any;
  globalScore: number;
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

/**
 * GET /api/v1/storefront/trending
 * High-performance, SWR-cached endpoint returning trending products across ALL users
 * (views, attention span/dwell times, saves, searches, and sales momentum),
 * blended with personalized signals that take priority without truncating into a shortlist.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 100);
    const sessionId = searchParams.get("session_id") || request.headers.get("x-session-id");
    const user = await getAuthenticatedUser(request);

    // ── STEP 1: Compute / Retrieve Global Trending Pool (Across All Users) ──
    const globalTrending = await getOrComputeCached<{ products: ScoredProduct[] }>(
      "storefront:trending:global_pool_v2",
      180, // fresh for 3 minutes
      async () => {
        const supabase = createServiceClient();
        const now = Date.now();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

        // Concurrently fetch global activity signals
        const [viewsRes, wishlistsRes, searchesRes, productsRes] = await Promise.all([
          supabase
            .from("product_views")
            .select("product_id, event_type, duration_seconds, scroll_depth, created_at, session_id, user_id")
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
              variants:product_variants(id, size, color, color_hex, is_active, inventory(quantity, reserved_quantity))
            `)
            .eq("status", "active")
            .limit(200),
        ]);

        const allProducts = productsRes.data ?? [];
        if (allProducts.length === 0) return { products: [] };

        const views = viewsRes.data ?? [];
        const wishlists = wishlistsRes.data ?? [];
        const searches = searchesRes.data ?? [];

        // Global engagement score accumulator
        const engagementScores = new Map<string, number>();

        // 1. Process global views, attention span, dwell time, and detailed reading
        for (const v of views) {
          const createdAt = new Date(v.created_at).getTime();
          const recencyBoost =
            createdAt >= Date.parse(threeDaysAgo) ? 1.5 : createdAt >= Date.parse(sevenDaysAgo) ? 1.2 : 1.0;

          let points = 1.0;
          const duration = Number(v.duration_seconds || 0);

          // Reward attention span & reading details
          if (v.event_type === "read_details" || duration >= 20 || (v.scroll_depth && v.scroll_depth >= 50)) {
            points = 6.0;
          } else if (duration >= 10) {
            points = 3.5;
          } else if (v.event_type === "cart_add") {
            points = 7.0;
          } else if (v.event_type === "wishlist_add") {
            points = 6.0;
          } else if (v.event_type === "click") {
            points = 2.0;
          }

          const total = points * recencyBoost;
          engagementScores.set(v.product_id, (engagementScores.get(v.product_id) ?? 0) + total);
        }

        // 2. Process global wishlist saves
        for (const w of wishlists) {
          const addedAt = new Date(w.added_at).getTime();
          const recencyBoost = addedAt >= Date.parse(threeDaysAgo) ? 1.5 : 1.0;
          engagementScores.set(w.product_id, (engagementScores.get(w.product_id) ?? 0) + 5.0 * recencyBoost);
        }

        // 3. Process search query keyword relevance
        const searchTerms = searches
          .map((s) => s.query.toLowerCase().trim())
          .filter((q) => q.length >= 3);

        if (searchTerms.length > 0) {
          for (const p of allProducts) {
            const titleLower = p.name.toLowerCase();
            const brandLower = (p.brand || "").toLowerCase();
            let matches = 0;
            for (const term of searchTerms) {
              if (titleLower.includes(term) || brandLower.includes(term)) {
                matches++;
              }
            }
            if (matches > 0) {
              engagementScores.set(p.id, (engagementScores.get(p.id) ?? 0) + Math.min(matches * 2.5, 12));
            }
          }
        }

        // 4. Calculate final global score for EVERY product (guarantees no short list)
        const scored: ScoredProduct[] = allProducts.map((p) => {
          const engagement = engagementScores.get(p.id) ?? 0;
          const salesBonus = Math.min(Number(p.total_sold ?? 0) * 0.8, 25);
          const ratingBonus = Number(p.average_rating ?? 4.5) * 4;
          const reviewBonus = Math.min(Number(p.review_count ?? 5), 50) * 0.3;
          const dealBonus =
            p.compare_at_price && p.compare_at_price > p.base_price ? 2.5 : 0;

          // Baseline ensures every product participates so the list is always complete
          const globalScore = 15.0 + engagement + salesBonus + ratingBonus + reviewBonus + dealBonus;
          return { product: p, globalScore };
        });

        // Sort descending by global momentum
        scored.sort((a, b) => b.globalScore - a.globalScore);

        return { products: scored };
      },
      600 // 10 minutes stale-while-revalidate window
    );

    const pool = globalTrending?.products ?? [];
    if (pool.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // ── STEP 2: Apply Personalization Boost if User / Session Exists ──
    const hasIdentifier = Boolean(user?.id || (sessionId && UUID_RE.test(sessionId)));

    if (!hasIdentifier) {
      // Anonymous without session: return top global trending items up to limit
      const data = pool.slice(0, limit).map((s) => formatProduct(s.product));
      return NextResponse.json(
        { success: true, data, source: "global_trending" },
        { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
      );
    }

    // Fetch user's individual interactions to prioritize personalized items
    const supabase = createServiceClient();
    const [userViewsRes, userWishlistRes] = await Promise.all([
      user?.id && sessionId && UUID_RE.test(sessionId)
        ? supabase
            .from("product_views")
            .select("product_id, event_type, duration_seconds")
            .or(`user_id.eq.${user.id},session_id.eq.${sessionId}`)
            .limit(40)
        : user?.id
        ? supabase
            .from("product_views")
            .select("product_id, event_type, duration_seconds")
            .eq("user_id", user.id)
            .limit(40)
        : sessionId && UUID_RE.test(sessionId)
        ? supabase
            .from("product_views")
            .select("product_id, event_type, duration_seconds")
            .eq("session_id", sessionId)
            .limit(40)
        : Promise.resolve({ data: [] }),
      user?.id
        ? supabase.from("wishlists").select("product_id").eq("user_id", user.id).limit(30)
        : Promise.resolve({ data: [] }),
    ]);

    const userInteractedIds = new Set<string>();
    const userCategories = new Set<string>();
    const userBrands = new Set<string>();

    for (const v of userViewsRes.data ?? []) {
      userInteractedIds.add(v.product_id);
    }
    for (const w of userWishlistRes.data ?? []) {
      userInteractedIds.add(w.product_id);
    }

    // Find user's favorite categories & brands based on their interactions
    for (const item of pool) {
      if (userInteractedIds.has(item.product.id)) {
        if (item.product.category?.id) userCategories.add(item.product.category.id);
        if (item.product.brand) userBrands.add(item.product.brand.toLowerCase());
      }
    }

    // Blend: Personalized items get priority boost, but the entire global list remains intact
    const blended = pool.map((item) => {
      let personalBoost = 0;
      const pid = item.product.id;
      const brand = (item.product.brand || "").toLowerCase();
      const catId = item.product.category?.id;

      // Direct personal interest boost (takes priority at the top)
      if (userInteractedIds.has(pid)) {
        personalBoost += 25.0;
      }

      // Affinity boost for matching category/brand
      if (catId && userCategories.has(catId)) {
        personalBoost += 8.0;
      }
      if (brand && userBrands.has(brand)) {
        personalBoost += 5.0;
      }

      return {
        product: item.product,
        totalScore: item.globalScore + personalBoost,
        isPersonalized: personalBoost > 0,
      };
    });

    blended.sort((a, b) => b.totalScore - a.totalScore);

    // Guaranteed full list: slice exactly up to limit
    const finalProducts = blended.slice(0, limit).map((s) => formatProduct(s.product));

    return NextResponse.json(
      {
        success: true,
        data: finalProducts,
        source: userInteractedIds.size > 0 ? "personalized_trending_blend" : "global_trending",
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
