import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "24", 10), 50);
    const offset = (page - 1) * limit;

    if (!q.trim()) {
      return NextResponse.json({
        data: [],
        meta: { total: 0, page: 1, limit, pages: 1 },
      });
    }

    const serviceClient = createServiceClient();

    // Use Supabase textSearch / ilike for full text matching
    const { data: products, count, error } = await serviceClient
      .from("products")
      .select(
        `
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
      `,
        { count: "exact" }
      )
      .eq("status", "active")
      .or(`name.ilike.%${q}%,description.ilike.%${q}%,short_description.ilike.%${q}%,material.ilike.%${q}%`)
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 500 }
      );
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
          ? {
              cloudinary_id: primaryImg.cloudinary_public_id,
              alt: primaryImg.alt_text || p.name,
            }
          : null,
        category: p.category,
        average_rating: p.average_rating,
        review_count: p.review_count,
      };
    });

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
    return serverError(err);
  }
}
