import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient, getRequestDataMode } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { serverError, dbError } from "../../_lib/http";
import { getOrComputeCached, invalidateCache } from "../../_lib/storefront-cache";
import { publicCache } from "../../_lib/public-cache";

function seededDateShuffle<T>(arr: T[], dateStr: string): T[] {
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    const j = Math.floor(rnd * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

/**
 * GET /api/v1/storefront/hero
 * Public: returns the hero carousel products with their product details.
 * Strictly features products with transparent backgrounds (max 10), rotated
 * over a deterministic 24-hour cycle.
 */
export async function GET() {
  try {
    const dataMode = await getRequestDataMode();
    const isTest = dataMode === "test";
    const todayUtc = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const data = await getOrComputeCached(
      `storefront:hero:active_${dataMode}_${todayUtc}`,
      600, // 10 minutes
      async () => {
        const supabase = createServiceClient();

        // 1. Check if admin configured custom hero items
        const { data: heroRows, error: heroErr } = await supabase
          .from("hero_carousel")
          .select(`
            id, product_id, sort_order, is_active,
            product:products!hero_carousel_product_id_fkey(
              id, name, slug, base_price, compare_at_price, average_rating, review_count, tags, has_transparent_bg, brand, short_description, dominant_color,
              category:categories(id, name, slug, parent:parent_id(id, name, slug)),
              images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id, has_transparent_bg, dominant_color),
              variants:product_variants(id, size, color, color_hex, is_active, has_transparent_bg)
            )
          `)
          .eq("is_active", true)
          .eq("is_test", isTest)
          .order("sort_order", { ascending: true });

        // Filter custom hero items to only those with transparent backgrounds
        const validCustomRows = (heroRows ?? []).filter((row: any) => {
          const p = row.product;
          return p && p.has_transparent_bg === true;
        });

        if (validCustomRows.length >= 1) {
          return validCustomRows.slice(0, 10);
        }

        // 2. Automated 24-hour rotation pool: all active products with transparent backgrounds
        let autoProducts: any[] = [];
        const { data: productsWithColor, error: queryErr } = await supabase
          .from("products")
          .select(`
            id, name, slug, base_price, compare_at_price, average_rating, review_count, tags, has_transparent_bg, brand, short_description, dominant_color,
            category:categories(id, name, slug, parent:parent_id(id, name, slug)),
            images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id, has_transparent_bg, dominant_color),
            variants:product_variants(id, size, color, color_hex, is_active, has_transparent_bg)
          `)
          .eq("status", "active")
          .eq("has_transparent_bg", true)
          .eq("is_test", isTest);

        if (queryErr && /dominant_color/i.test(queryErr.message)) {
          // Fallback if dominant_color column has not yet been applied to Supabase
          const { data: fallbackProducts } = await supabase
            .from("products")
            .select(`
              id, name, slug, base_price, compare_at_price, average_rating, review_count, tags, has_transparent_bg, brand, short_description,
              category:categories(id, name, slug, parent:parent_id(id, name, slug)),
              images:product_images(id, cloudinary_public_id, is_primary, sort_order, variant_id, has_transparent_bg),
              variants:product_variants(id, size, color, color_hex, is_active, has_transparent_bg)
            `)
            .eq("status", "active")
            .eq("has_transparent_bg", true)
            .eq("is_test", isTest);
          autoProducts = fallbackProducts ?? [];
        } else {
          autoProducts = productsWithColor ?? [];
        }

        if (autoProducts.length === 0) {
          return [];
        }

        // Deterministic pseudo-random shuffle seeded by today's UTC date (YYYY-MM-DD)
        const shuffled = seededDateShuffle(autoProducts, todayUtc || "2026-09-29");
        const top10 = shuffled.slice(0, 10);

        return top10.map((p, idx) => ({
          id: `hero-auto-${p.id}`,
          product_id: p.id,
          sort_order: idx,
          is_active: true,
          product: p,
        }));
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
 * Only accepts product items with transparent backgrounds.
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

    // Verify that every product in hero has transparent background
    if (products.length > 0) {
      const productIds = products.map((p: any) => p.product_id);
      const { data: verifiedProducts } = await supabase
        .from("products")
        .select("id, has_transparent_bg")
        .in("id", productIds);

      const transparentMap = new Map((verifiedProducts ?? []).map((p: any) => [p.id, Boolean(p.has_transparent_bg)]));
      const transparentOnly = products.filter((p: any) => transparentMap.get(p.product_id) === true);

      if (transparentOnly.length === 0 && products.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Only products with a transparent background can be added to the hero carousel.",
            code: "TRANSPARENT_BG_REQUIRED",
          },
          { status: 400 }
        );
      }

      // Clear existing entries for this mode
      const { error: delErr } = await supabase.from("hero_carousel").delete().eq("is_test", isTest);
      if (delErr) return dbError(delErr);

      const rows = transparentOnly.slice(0, 10).map((p: any, i: number) => ({
        product_id: p.product_id,
        sort_order: p.sort_order ?? i,
        is_active: p.is_active !== false,
        is_test: isTest,
      }));

      const { error: insErr } = await supabase.from("hero_carousel").insert(rows);
      if (insErr) return dbError(insErr);
    } else {
      const { error: delErr } = await supabase.from("hero_carousel").delete().eq("is_test", isTest);
      if (delErr) return dbError(delErr);
    }

    invalidateCache(`storefront:hero:active_${dataMode}`);
    invalidateCache("storefront:hero:active");
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
