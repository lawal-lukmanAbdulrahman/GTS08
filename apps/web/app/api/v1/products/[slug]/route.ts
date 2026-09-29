import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { optionalStaff, requirePermission } from "../../_lib/staff-access";
import { canSeeCost, stripCostFields } from "../../_lib/privacy";
import { serverError, dbError } from "../../_lib/http";
import { invalidateStorefrontCaches } from "../../_lib/storefront-cache";
import { logActivity } from "../../_lib/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // ── Security: validate param format before touching the database ──────────
    // A valid slug is alphanumeric + hyphens (max 200 chars).
    // A valid UUID is the standard 8-4-4-4-12 hex format.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,198}[a-z0-9]$|^[a-z0-9]$/i;

    const isUuid = UUID_RE.test(slug);
    const isValidSlug = SLUG_RE.test(slug);

    if (!isUuid && !isValidSlug) {
      return NextResponse.json(
        { error: "Invalid product identifier", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    let query = serviceClient
      .from("products")
      .select(
        `
        *,
        category:categories(id, name, slug, parent:parent_id(id, name, slug)),
        images:product_images(*),
        variants:product_variants(*, inventory(quantity, reserved_quantity))
      `
      );

    if (isUuid) {
      query = query.eq("id", slug);
    } else {
      query = query.eq("slug", slug);
    }

    // The public sees active products only; staff can open a draft to edit it.
    const staff = await optionalStaff(request);
    if (!staff) query = query.eq("status", "active");

    const { data: product, error } = await query.maybeSingle();

    if (error || !product) {
      return NextResponse.json(
        { error: "Product not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Transform variant inventory availability
    const variants = (product.variants || []).map((v: any) => {
      const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
      const available = (inv?.quantity || 0) - (inv?.reserved_quantity || 0);

      return {
        ...v,
        effective_price: product.base_price + (v.price_modifier || 0),
        available,
        in_stock: available > 0,
      };
    });

    // Fetch recent 3 approved reviews
    const { data: reviews } = await serviceClient
      .from("reviews")
      .select("id, rating, title, body, created_at, user:users!reviews_user_id_fkey(full_name)")
      .eq("product_id", product.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(3);

    const descImages = (product.images || [])
      .filter((img: any) => !img.is_primary && !img.variant_id)
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((img: any) => ({
        id: img.id,
        url: img.cloudinary_public_id,
        alt: img.alt_text || product.name,
        sort_order: img.sort_order || 0,
      }));

    const payload = {
      ...product,
      description_images: descImages,
      description_image_urls: descImages.map((img: any) => img.url),
      variants,
      reviews: reviews || [],
    };

    return NextResponse.json({ data: canSeeCost(staff) ? payload : stripCostFields(payload) });
  } catch (err: any) {
    return serverError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const access = await requirePermission(request, "can_manage_products");
    if (!access.ok) return access.response;
    const user = access.user;

    const { slug } = await params;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,198}[a-z0-9]$|^[a-z0-9]$/i;

    const isUuid = UUID_RE.test(slug);
    const isValidSlug = SLUG_RE.test(slug);

    if (!isUuid && !isValidSlug) {
      return NextResponse.json(
        { error: "Invalid product identifier", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    let lookup = serviceClient.from("products").select("id").limit(1);
    if (isUuid) {
      lookup = lookup.eq("id", slug);
    } else {
      lookup = lookup.eq("slug", slug);
    }

    const { data: product, error: findError } = await lookup.maybeSingle();
    if (findError || !product) {
      return NextResponse.json(
        { error: "Product not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const productId = product.id;

    // Fetch variant IDs for this product
    const { data: variants } = await serviceClient
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);

    const variantIds = (variants || []).map((v: any) => v.id);

    if (variantIds.length > 0) {
      await serviceClient.from("stock_movements").delete().in("variant_id", variantIds);
      await serviceClient.from("cart_items").delete().in("variant_id", variantIds);
      await serviceClient.from("checkout_reservations").delete().in("variant_id", variantIds);
      await serviceClient.from("inventory").delete().in("variant_id", variantIds);
      await serviceClient.from("product_flags").delete().in("variant_id", variantIds);
      await serviceClient.from("product_variants").delete().in("id", variantIds);
    }

    await serviceClient.from("product_images").delete().eq("product_id", productId);
    await serviceClient.from("product_drafts").delete().eq("product_id", productId);
    await serviceClient.from("product_flags").delete().eq("product_id", productId);
    await serviceClient.from("hero_carousel").delete().eq("product_id", productId);
    await serviceClient.from("product_views").delete().eq("product_id", productId);
    await serviceClient.from("reviews").delete().eq("product_id", productId);
    await serviceClient.from("wishlists").delete().eq("product_id", productId);

    const { error: delError } = await serviceClient
      .from("products")
      .delete()
      .eq("id", productId);

    if (delError) {
      return dbError(delError);
    }

    invalidateStorefrontCaches();

    await logActivity(serviceClient, {
      actorId: user.id,
      action: "product.delete",
      targetType: "product",
      targetId: productId,
    });

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
      id: productId,
    });
  } catch (err: any) {
    return serverError(err);
  }
}
