import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../_lib/http";

/**
 * GET /api/v1/search?q=...&limit=30&page=1&category=...&mode=storefront|pos
 *
 * Unified search API shared between storefront dropdown, search page, and POS.
 * Uses PostgreSQL FTS + pg_trgm for typo-tolerant, instant-feel search.
 *
 * Architecture:
 *   1. Call the `search_products` DB function (FTS + trigram fallback)
 *   2. Join category and primary image
 *   3. Return ranked results with relevance scores
 *
 * The client-side engine provides instant trie suggestions while this loads.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().slice(0, 120);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30), 60);
    const offset = (page - 1) * limit;
    const category = searchParams.get("category") || null;
    const mode = searchParams.get("mode") || "storefront";

    if (!q) {
      return NextResponse.json({
        data: [],
        suggestions: [],
        meta: { total: 0, page: 1, limit, pages: 1, query: "" },
      });
    }

    const supabase = createServiceClient();

    // 1. Run the unified search function
    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_products",
      {
        search_query: q,
        result_limit: limit,
        result_offset: offset,
        category_filter: category,
        active_only: true,
      }
    );

    if (searchError) {
      console.error("[search] search_products RPC error:", searchError.message);
      // Fallback to ilike search if the RPC function doesn't exist yet
      return await fallbackSearch(supabase, q, limit, offset, page);
    }

    const results = (searchResults as any[]) || [];

    // 2. Fetch category + images for each result
    const productIds = results.map((r: any) => r.id);
    let enriched: any[] = results;

    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          base_price,
          compare_at_price,
          status,
          is_featured,
          total_sold,
          average_rating,
          review_count,
          category:categories(name, slug),
          images:product_images(cloudinary_public_id, alt_text, is_primary)
        `)
        .in("id", productIds);

      if (productsData) {
        const productMap = new Map<string, any>();
        for (const p of productsData) productMap.set(p.id, p);

        // Preserve relevance ordering from the search function
        enriched = results.map((r: any) => {
          const full = productMap.get(r.id);
          if (!full) return null;
          const primaryImg = full.images?.find((img: any) => img.is_primary) || full.images?.[0];
          return {
            id: full.id,
            name: full.name,
            slug: full.slug,
            base_price: full.base_price,
            compare_at_price: full.compare_at_price,
            status: full.status,
            is_featured: full.is_featured,
            total_sold: full.total_sold,
            average_rating: full.average_rating,
            review_count: full.review_count,
            primary_image: primaryImg
              ? { cloudinary_id: primaryImg.cloudinary_public_id, alt: primaryImg.alt_text || full.name }
              : null,
            category: full.category,
            relevance: r.relevance,
          };
        }).filter(Boolean);
      }
    }

    // 3. Get "did you mean?" suggestions from popular queries when results are few
    let suggestions: string[] = [];
    if (enriched.length < 3) {
      const { data: sugData } = await supabase
        .from("search_queries")
        .select("query")
        .gt("results_count", 0)
        .order("created_at", { ascending: false })
        .limit(500);

      if (sugData && sugData.length > 0) {
        // Find queries similar to the user's input using simple trigram-like comparison
        const lowerQ = q.toLowerCase();
        const scored = new Map<string, { count: number; sim: number }>();
        for (const row of sugData) {
          const candidate = row.query.toLowerCase().trim();
          if (candidate === lowerQ || candidate.length < 2) continue;
          const sim = jaroWinkler(lowerQ, candidate);
          if (sim > 0.7) {
            const existing = scored.get(candidate);
            if (existing) {
              existing.count++;
            } else {
              scored.set(candidate, { count: 1, sim });
            }
          }
        }
        suggestions = Array.from(scored.entries())
          .sort((a, b) => (b[1].count * b[1].sim) - (a[1].count * a[1].sim))
          .slice(0, 5)
          .map(([term]) => term);
      }
    }

    const total = enriched.length;
    const pages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      data: enriched,
      suggestions,
      meta: { total, page, limit, pages, query: q },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

// ─── Fallback: ilike search (before migration is run) ───────────────────────
async function fallbackSearch(supabase: any, q: string, limit: number, offset: number, page: number) {
  // Clean query for PostgREST
  const clean = q.replace(/[,()%*\\";]|--/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) {
    return NextResponse.json({ data: [], suggestions: [], meta: { total: 0, page: 1, limit, pages: 1, query: q } });
  }

  const { data: products, count, error } = await supabase
    .from("products")
    .select(
      `id, name, slug, base_price, compare_at_price, status, is_featured, total_sold, average_rating, review_count,
       category:categories(name, slug),
       images:product_images(cloudinary_public_id, alt_text, is_primary)`,
      { count: "exact" }
    )
    .eq("status", "active")
    .or(`name.ilike.%${clean}%,description.ilike.%${clean}%,short_description.ilike.%${clean}%,material.ilike.%${clean}%,sku.ilike.%${clean}%`)
    .order("total_sold", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ data: [], suggestions: [], meta: { total: 0, page, limit, pages: 1, query: q } });
  }

  const transformed = (products || []).map((p: any) => {
    const primaryImg = p.images?.find((img: any) => img.is_primary) || p.images?.[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      base_price: p.base_price,
      compare_at_price: p.compare_at_price,
      primary_image: primaryImg
        ? { cloudinary_id: primaryImg.cloudinary_public_id, alt: primaryImg.alt_text || p.name }
        : null,
      category: p.category,
      average_rating: p.average_rating,
      review_count: p.review_count,
    };
  });

  const total = count || transformed.length;
  return NextResponse.json({
    data: transformed,
    suggestions: [],
    meta: { total, page, limit, pages: Math.ceil(total / limit) || 1, query: q },
  });
}

// ─── Jaro-Winkler similarity (fast string distance for "did you mean") ──────
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler boost for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}
