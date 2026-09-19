import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../_lib/access";
import { computeStockStatus, variantAvailable, type InventoryRow } from "../../_lib/stock-status";

interface RawVariant {
  id: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  sku: string | null;
  price_modifier: number;
  is_active: boolean;
  inventory: InventoryRow | null;
}

interface RawProduct {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  category: { id: string; name: string; slug: string } | null;
  images: Array<{ cloudinary_public_id: string; alt_text: string | null; is_primary: boolean }> | null;
  variants: RawVariant[] | null;
}

function mapProduct(product: RawProduct) {
  const variants = (product.variants || []).filter((v) => v.is_active);
  const inventoryRows = variants.map((v) => v.inventory).filter((row): row is InventoryRow => !!row);
  const primaryImage =
    product.images?.find((img) => img.is_primary) || product.images?.[0] || null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    base_price: product.base_price,
    category: product.category,
    primary_image: primaryImage
      ? { cloudinary_id: primaryImage.cloudinary_public_id, alt: primaryImage.alt_text || product.name }
      : null,
    stock_status: computeStockStatus(inventoryRows),
    variants: variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      color_hex: v.color_hex,
      sku: v.sku,
      price_modifier: v.price_modifier,
      quantity: v.inventory?.quantity ?? 0,
      available: v.inventory ? variantAvailable(v.inventory) : 0,
    })),
  };
}

/**
 * The search text goes into a PostgREST filter string, where , ( ) and % have
 * meaning. Strip them so text can't add clauses of its own.
 */
function cleanSearch(raw: string): string {
  return raw.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim();
}

const EMPTY_PAGE = (limit: number) => ({ data: [], meta: { total: 0, page: 1, limit, pages: 1 } });

export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const q = cleanSearch(searchParams.get("q") || "");
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30), 60);
  const offset = (page - 1) * limit;

  const serviceClient = createServiceClient();

  // A top-level category tab covers its sub-categories too.
  let categoryIds: string[] | null = null;
  if (category && category !== "all") {
    const { data: cats, error: catError } = await serviceClient
      .from("categories")
      .select("id, parent_id, slug")
      .eq("is_active", true);
    if (catError) {
      return NextResponse.json({ error: catError.message, code: "DATABASE_ERROR" }, { status: 500 });
    }
    const all = (cats || []) as Array<{ id: string; parent_id: string | null; slug: string }>;
    const root = all.find((c) => c.slug === category);
    if (!root) return NextResponse.json(EMPTY_PAGE(limit));
    categoryIds = all.filter((c) => c.id === root.id || c.parent_id === root.id).map((c) => c.id);
  }

  let query = serviceClient
    .from("products")
    .select(
      `
      id, name, slug, base_price,
      category:categories(id, name, slug),
      images:product_images(cloudinary_public_id, alt_text, is_primary),
      variants:product_variants(id, size, color, color_hex, sku, price_modifier, is_active,
        inventory(quantity, reserved_quantity, low_stock_threshold))
      `,
      { count: "exact" }
    )
    .eq("status", "active");

  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  if (categoryIds) query = query.in("category_id", categoryIds);

  // No search text: the POS opens on the catalogue, best sellers first.
  const { data, count, error } = await query
    .order("total_sold", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  const products = ((data as unknown as RawProduct[]) || []).map(mapProduct);
  const total = count || products.length;

  return NextResponse.json({
    data: products,
    meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
}
