import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePermission } from "../_lib/staff-access";
import { serverError, dbError } from "../_lib/http";

function resolveVariantImage(
  _productName: string,
  _variantColor?: string,
  variantImageUrl?: string
): string {
  return variantImageUrl || "";
}

export async function GET(request: NextRequest) {
  // Stock levels and product costs are for the people who manage inventory, not the public.
  const access = await requirePermission(request, "can_manage_inventory");
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get("low_stock") === "true";
    const categorySlug = searchParams.get("category");
    const brand = searchParams.get("brand");

    const serviceClient = createServiceClient();

    const query = serviceClient
      .from("inventory")
      .select(`
        id,
        variant_id,
        quantity,
        reserved_quantity,
        low_stock_threshold,
        last_restocked_at,
        last_sold_at,
        updated_at,
        variant:product_variants(
          id,
          size,
          color,
          color_hex,
          sku,
          barcode,
          image_url,
          price_modifier,
          is_active,
          product:products(
            id,
            name,
            slug,
            base_price,
            cost_price,
            brand,
            status,
            category:categories(id, name, slug),
            images:product_images(id, cloudinary_public_id, alt_text, is_primary, sort_order, variant_id)
          )
        )
      `)
      .order("updated_at", { ascending: false });

    const { data: inventoryList, error } = await query;

    if (error) {
      return dbError(error, "DATABASE_ERROR", 500);
    }

    const transformed = (inventoryList || [])
      .filter((inv: any) => {
        const available = (inv.quantity || 0) - (inv.reserved_quantity || 0);
        if (lowStockOnly && available > (inv.low_stock_threshold || 5)) {
          return false;
        }
        if (categorySlug && inv.variant?.product?.category?.slug !== categorySlug) {
          return false;
        }
        if (brand && inv.variant?.product?.brand?.toLowerCase() !== brand.toLowerCase()) {
          return false;
        }
        return true;
      })
      .map((inv: any) => {
        const product = inv.variant?.product;
        const available = Math.max(0, (inv.quantity || 0) - (inv.reserved_quantity || 0));
        const threshold = inv.low_stock_threshold || 5;

        // 1. Check direct variant image
        let rawImage = inv.variant?.image_url;

        // 2. Check product images linked to variant
        if (!rawImage && product?.images && Array.isArray(product.images)) {
          const varSpecific = product.images.find((img: any) => img.variant_id === inv.variant_id);
          if (varSpecific) {
            rawImage = varSpecific.cloudinary_public_id;
          } else if (inv.variant?.color && inv.variant.color !== "Default") {
            const colorLower = inv.variant.color.toLowerCase();
            const colorMatch = product.images.find((img: any) => 
              (img.alt_text && img.alt_text.toLowerCase().includes(colorLower)) ||
              (img.cloudinary_public_id && img.cloudinary_public_id.toLowerCase().includes(colorLower))
            );
            if (colorMatch) {
              rawImage = colorMatch.cloudinary_public_id;
            }
          }

          // 3. Fallback to product primary image
          if (!rawImage) {
            const sorted = [...product.images].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
            rawImage = sorted[0]?.cloudinary_public_id;
          }
        }

        const effectiveImage = resolveVariantImage(
          product?.name || "",
          inv.variant?.color,
          rawImage
        );

        const basePrice = product?.base_price || 0;
        const costPrice = product?.cost_price || Math.round(basePrice * 0.7);

        return {
          id: inv.id,
          variant_id: inv.variant_id,
          quantity: inv.quantity || 0,
          reserved_quantity: inv.reserved_quantity || 0,
          available_quantity: available,
          low_stock_threshold: threshold,
          last_restocked_at: inv.last_restocked_at,
          last_sold_at: inv.last_sold_at,
          updated_at: inv.updated_at,
          is_low_stock: available <= threshold && available > 0,
          is_out_of_stock: available === 0,
          product_id: product?.id,
          product_name: product?.name || "Unknown Product",
          product_slug: product?.slug || "",
          product_status: product?.status || "active",
          brand: product?.brand || "GTS",
          category_name: product?.category?.name || "General",
          category_slug: product?.category?.slug || "general",
          variant_size: inv.variant?.size || "Standard",
          variant_color: inv.variant?.color || "Default",
          variant_color_hex: inv.variant?.color_hex,
          sku: inv.variant?.sku || product?.sku || "N/A",
          barcode: inv.variant?.barcode || "N/A",
          unit_price: basePrice,
          cost_price: costPrice,
          total_valuation: (basePrice > 100000 ? basePrice / 100 : basePrice) * available,
          image: effectiveImage,
        };
      });

    return NextResponse.json({ data: transformed });
  } catch (err: any) {
    return serverError(err);
  }
}
