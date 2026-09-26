import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";
import { getOrComputeCached } from "../../_lib/storefront-cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * GET /api/v1/storefront/similar-finds
 * Generates dynamic, highly relevant recommendations for a product:
 * 1. Strictly excludes the current product itself
 * 2. "People Also Added to Cart / Bought With" co-purchase analysis from order_items & cart_add events
 * 3. Direct category, sub-category, brand & tag affinity
 * 4. User-level personalized analytics (recent views, dwell time, wishlist, search history)
 * 5. High-performance SWR cache
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdOrSlug = searchParams.get("product_id") || searchParams.get("slug") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 50);
    const sessionId = searchParams.get("session_id") || request.headers.get("x-session-id");

    if (!productIdOrSlug) {
      return NextResponse.json({ ok: false, error: "product_id is required" }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    const cacheKey = `storefront:similar:${productIdOrSlug}:${user?.id || sessionId || "anon"}:${limit}`;

    const result = await getOrComputeCached(
      cacheKey,
      90, // 90 seconds fresh
      async () => {
        const supabase = createServiceClient();

        // 1. Fetch current product details to establish anchor features
        const isUuid = UUID_RE.test(productIdOrSlug);
        let baseProductQuery = supabase
          .from("products")
          .select("id, slug, name, brand, category_id, sub_category, tags, base_price");

        if (isUuid) {
          baseProductQuery = baseProductQuery.eq("id", productIdOrSlug);
        } else {
          baseProductQuery = baseProductQuery.or(`slug.eq.${productIdOrSlug},id.eq.${productIdOrSlug}`);
        }

        const { data: targetProductRow } = await baseProductQuery.maybeSingle();

        const currentId = targetProductRow?.id || (isUuid ? productIdOrSlug : null);
        const currentSlug = targetProductRow?.slug || productIdOrSlug;
        const currentCategoryId = targetProductRow?.category_id;
        const currentSubCategory = (targetProductRow?.sub_category || "").toLowerCase();
        const currentBrand = (targetProductRow?.brand || "").toLowerCase();
        const currentTags: string[] = (targetProductRow?.tags || []).map((t: string) => t.toLowerCase());
        const currentPrice = targetProductRow?.base_price || 0;

        // Set of IDs to strictly exclude (the current product itself)
        const excludeProductIds = new Set<string>();
        if (currentId) excludeProductIds.add(currentId);
        if (currentSlug) excludeProductIds.add(currentSlug);

        // Map of product id -> bonus score points
        const affinityScores = new Map<string, number>();

        // 2. SIGNAL A: Co-Purchase / "People bought together" via order_items
        if (currentId || currentSlug) {
          try {
            // Find recent orders containing this product
            const orderFilter = currentId
              ? `product_snapshot->>id.eq.${currentId},product_snapshot->>id.eq.${currentSlug}`
              : `product_snapshot->>id.eq.${currentSlug}`;

            const { data: containingOrders } = await supabase
              .from("order_items")
              .select("order_id")
              .or(orderFilter)
              .order("created_at", { ascending: false })
              .limit(40);

            const orderIds = Array.from(new Set((containingOrders || []).map((o) => o.order_id).filter(Boolean)));

            if (orderIds.length > 0) {
              const { data: coOrderItems } = await supabase
                .from("order_items")
                .select("product_snapshot")
                .in("order_id", orderIds.slice(0, 25))
                .limit(100);

              for (const item of coOrderItems || []) {
                const snap = item.product_snapshot as any;
                const coId = snap?.id;
                if (coId && !excludeProductIds.has(coId)) {
                  // Heavy score boost for co-purchased items
                  affinityScores.set(coId, (affinityScores.get(coId) || 0) + 40);
                }
              }
            }
          } catch {
            // Non-blocking
          }
        }

        // 3. SIGNAL B: "People also added to cart" via product_views (cart_add events)
        if (currentId) {
          try {
            const { data: cartSessions } = await supabase
              .from("product_views")
              .select("session_id")
              .eq("product_id", currentId)
              .eq("event_type", "cart_add")
              .limit(30);

            const coSessions = Array.from(new Set((cartSessions || []).map((s) => s.session_id).filter(Boolean)));
            if (coSessions.length > 0) {
              const { data: coCartItems } = await supabase
                .from("product_views")
                .select("product_id")
                .in("session_id", coSessions.slice(0, 15))
                .eq("event_type", "cart_add")
                .limit(50);

              for (const row of coCartItems || []) {
                if (row.product_id && !excludeProductIds.has(row.product_id)) {
                  affinityScores.set(row.product_id, (affinityScores.get(row.product_id) || 0) + 30);
                }
              }
            }
          } catch {
            // Non-blocking
          }
        }

        // 4. SIGNAL C: User's personalized analytics (wishlists, dwell times, recent searches)
        const userPreferredCategories = new Set<string>();
        const userPreferredBrands = new Set<string>();
        const userSearchKeywords: string[] = [];

        try {
          const userInteractionsPromises = [];

          // User's Wishlist
          if (user?.id) {
            userInteractionsPromises.push(
              supabase
                .from("wishlists")
                .select("product_id, products:product_id(category_id, brand)")
                .eq("user_id", user.id)
                .limit(15)
            );
          } else {
            userInteractionsPromises.push(Promise.resolve({ data: null }));
          }

          // User / Session Dwell & Detail reading
          if (user?.id || (sessionId && UUID_RE.test(sessionId))) {
            let viewQ = supabase
              .from("product_views")
              .select("duration_seconds, event_type, products:product_id(category_id, brand)")
              .order("created_at", { ascending: false })
              .limit(20);

            if (user?.id && sessionId && UUID_RE.test(sessionId)) {
              viewQ = viewQ.or(`user_id.eq.${user.id},session_id.eq.${sessionId}`);
            } else if (user?.id) {
              viewQ = viewQ.eq("user_id", user.id);
            } else if (sessionId) {
              viewQ = viewQ.eq("session_id", sessionId);
            }
            userInteractionsPromises.push(viewQ);
          } else {
            userInteractionsPromises.push(Promise.resolve({ data: null }));
          }

          // Recent Searches
          if (sessionId && UUID_RE.test(sessionId)) {
            userInteractionsPromises.push(
              supabase
                .from("search_queries")
                .select("query")
                .eq("session_id", sessionId)
                .order("created_at", { ascending: false })
                .limit(6)
            );
          } else {
            userInteractionsPromises.push(Promise.resolve({ data: null }));
          }

          const [wishlistRes, viewsRes, searchesRes] = await Promise.all(userInteractionsPromises);

          for (const item of (wishlistRes as any)?.data || []) {
            const prod = item.products as any;
            if (prod?.category_id) userPreferredCategories.add(prod.category_id);
            if (prod?.brand) userPreferredBrands.add(prod.brand.toLowerCase());
          }

          for (const v of (viewsRes as any)?.data || []) {
            const prod = v.products as any;
            if (prod?.category_id) userPreferredCategories.add(prod.category_id);
            if (prod?.brand) userPreferredBrands.add(prod.brand.toLowerCase());
          }

          for (const s of (searchesRes as any)?.data || []) {
            if (s.query && s.query.trim().length >= 2) {
              userSearchKeywords.push(s.query.trim().toLowerCase());
            }
          }
        } catch {
          // Non-blocking
        }

        // 5. Candidate Query: Fetch active products in matching category or related pool
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

        if (currentCategoryId) {
          candidateQuery = candidateQuery.eq("category_id", currentCategoryId);
        }

        const { data: primaryCandidates } = await candidateQuery;
        const candidates = (primaryCandidates || []).filter(
          (p) => !excludeProductIds.has(p.id) && !excludeProductIds.has(p.slug)
        );

        // If category had fewer items, expand to broader catalog
        if (candidates.length < 30) {
          const { data: widerPool } = await supabase
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

          const existingIds = new Set(candidates.map((c) => c.id));
          for (const item of widerPool || []) {
            if (!existingIds.has(item.id) && !excludeProductIds.has(item.id) && !excludeProductIds.has(item.slug)) {
              candidates.push(item);
            }
          }
        }

        // 6. Score each candidate
        const scored = candidates.map((p) => {
          let score = 0;
          const pSub = (p.sub_category || "").toLowerCase();
          const pBrand = (p.brand || "").toLowerCase();
          const pName = (p.name || "").toLowerCase();
          const pTags = (p.tags || []).map((t: string) => t.toLowerCase());

          // Direct category & sub-category similarity
          if (currentSubCategory && pSub && pSub === currentSubCategory) {
            score += 35;
          } else if (currentCategoryId && p.category_id === currentCategoryId) {
            score += 20;
          }

          // Same brand affinity
          if (currentBrand && pBrand && pBrand === currentBrand) {
            score += 25;
          }

          // Matching tags
          for (const tag of pTags) {
            if (currentTags.includes(tag)) {
              score += 6;
            }
          }

          // Co-purchase / Co-cart signal boost
          const coScore = affinityScores.get(p.id) || (p.slug ? affinityScores.get(p.slug) : 0) || 0;
          score += coScore;

          // User Personalization signals
          if (p.category_id && userPreferredCategories.has(p.category_id)) {
            score += 15;
          }
          if (pBrand && userPreferredBrands.has(pBrand)) {
            score += 10;
          }
          for (const term of userSearchKeywords) {
            if (pName.includes(term)) score += 12;
            if (pBrand.includes(term)) score += 8;
          }

          // Price proximity (complementary or similarly-tiered items)
          if (currentPrice > 0 && p.base_price > 0) {
            const ratio = p.base_price / currentPrice;
            if (ratio >= 0.4 && ratio <= 1.6) {
              score += 8;
            }
          }

          // Quality & Social Proof (Rating & Sales)
          score += Number(p.average_rating || 4) * 2;
          if (Number(p.total_sold || 0) > 15) {
            score += 5;
          }
          if (p.compare_at_price && p.compare_at_price > p.base_price) {
            score += 4;
          }

          return { product: p, score };
        });

        // 7. Sort by score descending and take the top `limit`
        scored.sort((a, b) => b.score - a.score);
        const topProducts = scored.slice(0, limit).map((s) => formatProduct(s.product));

        return {
          data: topProducts,
          source: affinityScores.size > 0 ? "co_purchase_and_affinity" : "category_and_personalized",
          total: topProducts.length,
        };
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
