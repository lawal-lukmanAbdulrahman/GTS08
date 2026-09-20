import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../_lib/staff-access";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("category");
    const size = searchParams.get("size");
    const color = searchParams.get("color");
    const minPrice = searchParams.get("min_price");
    const maxPrice = searchParams.get("max_price");
    const inStock = searchParams.get("in_stock") === "true";
    const includeAllStatus = searchParams.get("include_all_status") === "true";
    const sort = searchParams.get("sort") || "newest";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 100);
    const offset = (page - 1) * limit;

    const serviceClient = createServiceClient();
    const user = await getAuthenticatedUser(request);
    let isStaff = false;
    if (user) {
      const { data: userProfile } = await serviceClient.from("users").select("role").eq("id", user.id).maybeSingle();
      isStaff = Boolean(userProfile && ["admin", "inventory_staff"].includes(userProfile.role));
    }

    let query = serviceClient
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        sku,
        brand,
        sub_category,
        has_transparent_bg,
        short_description,
        description,
        material,
        base_price,
        compare_at_price,
        cost_price,
        status,
        is_featured,
        tags,
        total_sold,
        average_rating,
        review_count,
        created_at,
        category:categories(id, name, slug),
        images:product_images(id, cloudinary_public_id, alt_text, is_primary, sort_order, variant_id),
        variants:product_variants(id, size, color, color_hex, sku, price_modifier, is_active, inventory(quantity, reserved_quantity))
      `,
        { count: "exact" }
      );

    if (!includeAllStatus) {
      query = query.eq("status", "active");
    }

    // Filter by Category
    if (categorySlug) {
      const { data: catData } = await serviceClient
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .single();

      if (catData) {
        query = query.eq("category_id", catData.id);
      }
    }

    // Filter by Price
    if (minPrice) {
      query = query.gte("base_price", parseInt(minPrice, 10));
    }
    if (maxPrice) {
      query = query.lte("base_price", parseInt(maxPrice, 10));
    }

    // Sorting
    if (sort === "bestselling") {
      query = query.order("total_sold", { ascending: false });
    } else if (sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "price_asc") {
      query = query.order("base_price", { ascending: true });
    } else if (sort === "price_desc") {
      query = query.order("base_price", { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: products, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    // Transform products payload
    const transformed = (products || [])
      .map((p: any) => {
        const primaryImg = p.images?.find((img: any) => img.is_primary) || p.images?.[0];

        let hasAvailableStock = false;
        let hasLowStock = false;
        let totalQuantity = 0;

        const variants = (p.variants || [])
          .filter((v: any) => v.is_active)
          .map((v: any) => {
            const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
            const qty = inv?.quantity || 0;
            const reserved = inv?.reserved_quantity || 0;
            const available = qty - reserved;

            totalQuantity += qty;

            if (available > 0) hasAvailableStock = true;
            if (available > 0 && available <= 5) hasLowStock = true;

            return {
              id: v.id,
              size: v.size,
              color: v.color,
              color_hex: v.color_hex,
              sku: v.sku,
              price_modifier: v.price_modifier || 0,
              effective_price: p.base_price + (v.price_modifier || 0),
              quantity: qty,
              available,
            };
          });

        if (size && !variants.some((v: any) => v.size === size && v.available > 0)) {
          return null;
        }
        if (color && !variants.some((v: any) => v.color?.toLowerCase() === color.toLowerCase() && v.available > 0)) {
          return null;
        }
        if (inStock && !hasAvailableStock) {
          return null;
        }

        const badges: string[] = [];
        if (p.total_sold > 20) badges.push("bestseller");
        if (hasLowStock) badges.push("low_stock");
        if (p.compare_at_price && p.compare_at_price > p.base_price) badges.push("sale");

        // Profit Margin Calculation
        const costPrice = p.cost_price || 0;
        const profitKobo = p.base_price - costPrice;
        const marginPct = p.base_price > 0 && costPrice > 0 ? Math.round((profitKobo / p.base_price) * 100) : null;

        const descImages = (p.images || [])
          .filter((img: any) => !img.is_primary && !img.variant_id)
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((img: any) => ({
            id: img.id,
            url: img.cloudinary_public_id,
            alt: img.alt_text || p.name,
            sort_order: img.sort_order || 0,
          }));

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          brand: p.brand || null,
          sub_category: p.sub_category || null,
          has_transparent_bg: Boolean(p.has_transparent_bg),
          short_description: p.short_description,
          description: p.description,
          material: p.material,
          base_price: p.base_price,
          compare_at_price: p.compare_at_price,
          ...(isStaff
            ? {
                cost_price: costPrice,
                profit_kobo: profitKobo,
                margin_pct: marginPct,
              }
            : {}),
          status: p.status,
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
          })),
          description_images: descImages,
          description_image_urls: descImages.map((img: any) => img.url),
          category: p.category,
          tags: p.tags || [],
          average_rating: p.average_rating,
          review_count: p.review_count,
          in_stock: hasAvailableStock,
          has_low_stock: hasLowStock,
          total_quantity: totalQuantity,
          is_featured: p.is_featured,
          total_sold: p.total_sold,
          created_at: p.created_at,
          badges,
          variants,
        };
      })
      .filter(Boolean);

    const total = count || transformed.length;
    const pages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      data: transformed,
      meta: {
        total,
        page,
        limit,
        pages,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const access = await requirePermission(request, "can_manage_products");
    if (!access.ok) return access.response;
    const user = access.user;

    const serviceClient = createServiceClient();

    const body = await request.json();
    const {
      name,
      slug,
      sku,
      brand,
      base_price,
      compare_at_price,
      cost_price,
      category_id,
      category_name,
      description,
      short_description,
      status,
      is_featured,
      has_transparent_bg,
      image_url,
      primary_image_url,
      tags,
      variants,
    } = body;

    const isDraft = status === "draft";

    // ── Sanitisation & injection guard ────────────────────────────────────────
    const sanitisePostStr = (val: unknown, maxLen = 500): string =>
      val ? String(val).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLen) : "";
    const POST_INJECTION_RE =
      /('|")\s*;\s*(DROP|DELETE|INSERT|UPDATE|SELECT|ALTER|CREATE|TRUNCATE|EXEC|UNION|GRANT|REVOKE)\b/i;
    const POST_COMMENT_RE = /--|\bOR\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i;
    const postLooksLikeInjection = (val: unknown) =>
      val ? POST_INJECTION_RE.test(String(val)) || POST_COMMENT_RE.test(String(val)) : false;

    const postFieldsToCheck: Record<string, unknown> = { name, sku, brand, short_description };
    for (const [field, value] of Object.entries(postFieldsToCheck)) {
      if (postLooksLikeInjection(value)) {
        return NextResponse.json(
          { error: `Invalid characters detected in field: ${field}`, code: "INVALID_INPUT" },
          { status: 400 }
        );
      }
    }

    const finalName = sanitisePostStr(name, 200) || (isDraft ? "Untitled Draft Product" : "");
    const parsedBasePrice = base_price !== undefined && !isNaN(Number(base_price)) ? Math.max(0, Math.round(Number(base_price))) : (isDraft ? 0 : null);

    if (!finalName || (!isDraft && (parsedBasePrice === null || parsedBasePrice <= 0))) {
      return NextResponse.json({ error: "Name and base_price are required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const finalSlug = sanitisePostStr(slug, 200).toLowerCase().replace(/[^a-z0-9-]/g, "") ||
      (finalName ? finalName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : `draft-${Date.now()}`);
    const finalSku = sku ? sanitisePostStr(sku, 100) : `GTS-PRD-${Date.now().toString().slice(-6)}`;
    const cleanBrand = sanitisePostStr(brand, 100) || undefined;
    const cleanSubCategory = sanitisePostStr(body.sub_category, 150) || undefined;

    // Resolve category_id from category_name if needed
    let resolvedCategoryId = category_id || null;
    if (!resolvedCategoryId && category_name) {
      const cleanCat = sanitisePostStr(category_name, 100);
      if (cleanCat) {
        const { data: cat } = await serviceClient
          .from("categories")
          .select("id")
          .ilike("name", cleanCat)
          .maybeSingle();
        if (cat) resolvedCategoryId = cat.id;
      }
    }

    let finalTags = Array.isArray(tags)
      ? tags.map((t: unknown) => sanitisePostStr(t, 80)).filter(Boolean)
      : [];
    if (cleanBrand && !finalTags.includes(cleanBrand)) finalTags.push(cleanBrand);
    if (has_transparent_bg && !finalTags.includes("transparent-bg")) finalTags.push("transparent-bg");

    // Create Product
    const { data: product, error: prodErr } = await serviceClient
      .from("products")
      .insert({
        name: finalName,
        slug: finalSlug,
        sku: finalSku,
        brand: cleanBrand || null,
        sub_category: cleanSubCategory || null,
        has_transparent_bg: Boolean(has_transparent_bg),
        base_price: parsedBasePrice ?? 0,
        compare_at_price: compare_at_price ? Math.max(0, Math.round(Number(compare_at_price))) : null,
        cost_price: cost_price ? Math.max(0, Math.round(Number(cost_price))) : null,
        category_id: resolvedCategoryId,
        description: description ? String(description).slice(0, 50000) : null,
        short_description: short_description ? String(short_description).slice(0, 500) : (description ? String(description).slice(0, 180) : null),
        status: ["active", "draft", "archived"].includes(status) ? status : "active",
        is_featured: Boolean(is_featured),
        tags: finalTags,
        created_by: user.id,
      })
      .select()
      .single();

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message, code: "DATABASE_ERROR" }, { status: 400 });
    }

    // Attach Description Images if provided
    const descriptionImages = body.description_images || body.descriptionImages;
    const firstDescUrl = Array.isArray(descriptionImages) && descriptionImages.length > 0
      ? (typeof descriptionImages[0] === "string" ? descriptionImages[0] : descriptionImages[0]?.url)
      : null;

    // Attach Primary Image if provided (fallback to first description image)
    const targetHeroImg = primary_image_url || image_url || firstDescUrl;
    if (targetHeroImg) {
      await serviceClient.from("product_images").insert({
        product_id: product.id,
        cloudinary_public_id: targetHeroImg,
        alt_text: product.name,
        is_primary: true,
        sort_order: 0,
      });
    }

    if (Array.isArray(descriptionImages) && descriptionImages.length > 0) {
      const descRows = descriptionImages.map((item: any, idx: number) => ({
        product_id: product.id,
        cloudinary_public_id: typeof item === "string" ? item : item.url,
        alt_text: typeof item === "string" ? product.name : (item.alt_text || product.name),
        is_primary: false,
        sort_order: typeof item === "object" && item.sort_order !== undefined ? item.sort_order : idx,
      }));
      await serviceClient.from("product_images").insert(descRows);
    }

    // Create Variants & Inventory (fallback to default single variant for no-color products)
    const effectiveVariants = Array.isArray(variants) && variants.length > 0 ? variants : [
      {
        size: "Standard",
        color: "Default",
        color_hex: null,
        sku: `${finalSku}-STD-DEF`,
        image_url: targetHeroImg || null,
        has_transparent_bg: Boolean(has_transparent_bg),
        price_modifier: 0,
        quantity: 100,
        is_active: true,
      }
    ];

    for (const v of effectiveVariants) {
      const varSku = v.sku ? String(v.sku).trim().slice(0, 150) : `${finalSku}-${v.size || "STD"}-${(v.color || "DEF").slice(0, 3).toUpperCase()}`;

      const { data: variantData } = await serviceClient
        .from("product_variants")
        .insert({
          product_id: product.id,
          size: v.size ? String(v.size).trim().slice(0, 20) : null,
          color: v.color ? String(v.color).trim().slice(0, 50) : null,
          color_hex: v.color_hex ? String(v.color_hex).slice(0, 7) : null,
          sku: varSku,
          image_url: v.variant_image_url || v.image_url || null,
          has_transparent_bg: Boolean(v.has_transparent_bg),
          price_modifier: v.price_modifier || 0,
          is_active: v.is_active !== false,
        })
        .select()
        .single();

      if (variantData) {
        await serviceClient.from("inventory").insert({
          variant_id: variantData.id,
          quantity: Math.max(0, Number(v.quantity || 0)),
          low_stock_threshold: 5,
        });
      }
    }

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});

export const PUT = withIdempotency(async function PUT(request: NextRequest) {
  try {
    const access = await requirePermission(request, "can_manage_products");
    if (!access.ok) return access.response;
    const user = access.user;

    const serviceClient = createServiceClient();

    const body = await request.json();
    const {
      id,
      name,
      slug,
      sku,
      brand,
      base_price,
      compare_at_price,
      cost_price,
      category_id,
      category_name,
      status,
      is_featured,
      has_transparent_bg,
      primary_image_url,
      image_url,
      short_description,
      description,
      tags,
      variants,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Product ID is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    // ── Security: validate product ID is a UUID ───────────────────────────────
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(id))) {
      return NextResponse.json({ error: "Invalid product ID format", code: "INVALID_INPUT" }, { status: 400 });
    }

    // ── Sanitisation helpers (mirrors frontend) ───────────────────────────────
    const sanitiseStr = (val: unknown, maxLen = 500): string | undefined => {
      if (val === undefined || val === null) return undefined;
      return String(val).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLen);
    };
    const sanitiseSlug = (val: unknown): string | undefined => {
      if (!val) return undefined;
      return String(val).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 200) || undefined;
    };
    const VALID_STATUSES = ["active", "draft", "archived"] as const;
    type ProductStatus = typeof VALID_STATUSES[number];
    const sanitiseStatus = (val: unknown): ProductStatus | undefined => {
      if (VALID_STATUSES.includes(val as ProductStatus)) return val as ProductStatus;
      return undefined;
    };

    // ── SQL / XSS injection pattern guard ────────────────────────────────────
    // Supabase uses parameterised queries so injection can't execute, but we
    // still reject payloads with obvious attack patterns to prevent malicious
    // strings from persisting in the database.
    const INJECTION_RE =
      /('|")\s*;\s*(DROP|DELETE|INSERT|UPDATE|SELECT|ALTER|CREATE|TRUNCATE|EXEC|UNION|GRANT|REVOKE)\b/i;
    const SQL_COMMENT_RE = /--|\bOR\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i;

    const looksLikeInjection = (val: unknown): boolean => {
      if (!val) return false;
      const s = String(val);
      return INJECTION_RE.test(s) || SQL_COMMENT_RE.test(s);
    };

    const fieldsToCheck: Record<string, unknown> = { name, sku, brand, short_description, sub_category: body.sub_category };
    for (const [field, value] of Object.entries(fieldsToCheck)) {
      if (looksLikeInjection(value)) {
        return NextResponse.json(
          { error: `Invalid characters detected in field: ${field}`, code: "INVALID_INPUT" },
          { status: 400 }
        );
      }
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    const cleanName = sanitiseStr(name, 200);
    if (cleanName) updatePayload.name = cleanName;
    const cleanSlug = sanitiseSlug(slug);
    if (cleanSlug) updatePayload.slug = cleanSlug;
    const cleanSku = sanitiseStr(sku, 100);
    if (cleanSku) updatePayload.sku = cleanSku;
    const cleanBrand = sanitiseStr(brand, 100);
    if (brand !== undefined) updatePayload.brand = cleanBrand || null;
    const cleanSubCat = sanitiseStr(body.sub_category, 100);
    if (body.sub_category !== undefined) updatePayload.sub_category = cleanSubCat || null;
    if (base_price !== undefined) updatePayload.base_price = Math.max(0, Math.round(Number(base_price) || 0));
    if (compare_at_price !== undefined) updatePayload.compare_at_price = compare_at_price ? Math.max(0, Math.round(Number(compare_at_price))) : null;
    if (cost_price !== undefined) updatePayload.cost_price = cost_price ? Math.max(0, Math.round(Number(cost_price))) : null;
    if (category_id !== undefined) updatePayload.category_id = category_id || null;
    const cleanStatus = sanitiseStatus(status);
    if (cleanStatus) updatePayload.status = cleanStatus;
    if (is_featured !== undefined) updatePayload.is_featured = Boolean(is_featured);
    if (has_transparent_bg !== undefined) updatePayload.has_transparent_bg = Boolean(has_transparent_bg);
    const cleanShortDesc = sanitiseStr(short_description, 500);
    if (cleanShortDesc !== undefined) updatePayload.short_description = cleanShortDesc;
    if (description !== undefined) updatePayload.description = String(description).slice(0, 50000);

    // Tags — sanitise each tag individually
    let finalTags = Array.isArray(tags)
      ? tags.map((t: unknown) => sanitiseStr(t, 80)).filter(Boolean) as string[]
      : undefined;
    if (cleanBrand && finalTags && !finalTags.includes(cleanBrand)) {
      finalTags.push(cleanBrand);
    }
    if (has_transparent_bg && finalTags && !finalTags.includes("transparent-bg")) {
      finalTags.push("transparent-bg");
    }
    if (finalTags) updatePayload.tags = finalTags;

    // Resolve category_name if category_id not provided
    if (!updatePayload.category_id && category_name) {
      const cleanCatName = sanitiseStr(category_name, 100);
      if (cleanCatName) {
        const { data: cat } = await serviceClient
          .from("categories")
          .select("id")
          .ilike("name", cleanCatName)
          .maybeSingle();
        if (cat) updatePayload.category_id = cat.id;
      }
    }

    const { data: updatedProduct, error: updateErr } = await serviceClient
      .from("products")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message, code: "DATABASE_ERROR" }, { status: 400 });
    }

    // Update Primary Image
    const targetImage = primary_image_url || image_url;
    if (targetImage) {
      const { data: existingImg } = await serviceClient
        .from("product_images")
        .select("id")
        .eq("product_id", id)
        .eq("is_primary", true)
        .maybeSingle();

      if (existingImg) {
        await serviceClient
          .from("product_images")
          .update({ cloudinary_public_id: targetImage, alt_text: name || "Product" })
          .eq("id", existingImg.id);
      } else {
        await serviceClient.from("product_images").insert({
          product_id: id,
          cloudinary_public_id: targetImage,
          alt_text: name || "Product",
          is_primary: true,
          sort_order: 0,
        });
      }
    }

    // Sync Description Images if provided
    const descriptionImages = body.description_images || body.descriptionImages;
    if (Array.isArray(descriptionImages)) {
      // Remove existing non-primary, non-variant description images for this product
      await serviceClient
        .from("product_images")
        .delete()
        .eq("product_id", id)
        .eq("is_primary", false)
        .is("variant_id", null);

      if (descriptionImages.length > 0) {
        const descRows = descriptionImages.map((item: any, idx: number) => ({
          product_id: id,
          cloudinary_public_id: typeof item === "string" ? item : item.url,
          alt_text: typeof item === "string" ? (name || "Product Description") : (item.alt_text || name || "Product Description"),
          is_primary: false,
          sort_order: typeof item === "object" && item.sort_order !== undefined ? item.sort_order : idx,
        }));
        await serviceClient.from("product_images").insert(descRows);
      }
    }

    // Update Variants & Inventory if provided
    if (Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        if (v.id) {
          // Update existing variant
          await serviceClient
            .from("product_variants")
            .update({
              size: v.size || null,
              color: v.color || null,
              color_hex: v.color_hex || null,
              sku: v.sku || undefined,
            })
            .eq("id", v.id);

          if (v.quantity !== undefined) {
            await serviceClient
              .from("inventory")
              .update({ quantity: Number(v.quantity) })
              .eq("variant_id", v.id);
          }
        } else {
          // Insert new variant
          const varSku = v.sku || `${updatedProduct.sku || "GTS"}-${v.size || "STD"}-${(v.color || "DEF").slice(0, 3).toUpperCase()}`;
          const { data: newV } = await serviceClient
            .from("product_variants")
            .insert({
              product_id: id,
              size: v.size || null,
              color: v.color || null,
              color_hex: v.color_hex || null,
              sku: varSku,
              price_modifier: 0,
              is_active: true,
            })
            .select()
            .single();

          if (newV && v.quantity !== undefined) {
            await serviceClient.from("inventory").insert({
              variant_id: newV.id,
              quantity: Number(v.quantity || 0),
              low_stock_threshold: 5,
            });
          }
        }
      }
    }

    return NextResponse.json({ data: updatedProduct });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});
