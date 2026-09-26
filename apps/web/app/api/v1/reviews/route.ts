import { NextResponse } from "next/server";
import { filterEmail } from "../_lib/filter";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { sanitizeSafeText, sanitizeXss } from "@gts/utils";
import { serverError, dbError } from "../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const { data: reviews, error } = await serviceClient
      .from("reviews")
      .select("id, product_id, user_id, rating, title, body, is_approved, created_at, user:users!reviews_user_id_fkey(full_name)")
      .eq("product_id", productId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      return dbError(error, "DB_ERROR", 500);
    }

    return NextResponse.json({ data: reviews || [] });
  } catch (err: any) {
    return serverError(err);
  }
}

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Authentication required to leave a review.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId, rating, title, body: reviewBody, orderId: clientOrderId } = body;

    const sanitizedProductId = sanitizeSafeText(productId, 100);
    const sanitizedTitle = sanitizeSafeText(title || "Product Review", 120);
    const sanitizedBody = sanitizeXss(reviewBody, 2000);

    if (!sanitizedProductId || !rating || !sanitizedBody.trim()) {
      return NextResponse.json(
        { error: "Product ID, rating, and review text are required.", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // 1. Verify customer record
    const { data: customer } = await serviceClient
      .from("customers")
      .select("id")
      .or(`user_id.eq.${authUser.id},email.eq.${filterEmail(authUser.email ?? "")}`)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json(
        {
          error: "Verified purchase required. You can only review products you have ordered on GTS.",
          code: "VERIFIED_PURCHASE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 2. Query orders to verify purchase
    const { data: customerOrders } = await serviceClient
      .from("orders")
      .select("id, status, order_items(id, variant_id, product_snapshot)")
      .eq("customer_id", customer.id)
      .in("status", ["paid", "processing", "ready_for_pickup", "completed", "delivered"]);

    const validOrder = customerOrders?.find((ord: any) =>
      ord.order_items?.some((item: any) => {
        const snap = item.product_snapshot || {};
        return (
          snap.id === productId ||
          item.variant_id === productId ||
          (snap.sku && snap.sku.toLowerCase() === productId.toLowerCase())
        );
      })
    );

    const verifiedOrderId = validOrder?.id || clientOrderId;

    if (!validOrder && !clientOrderId) {
      return NextResponse.json(
        {
          error: "Verified purchase required. You can only review products you have ordered on GTS.",
          code: "VERIFIED_PURCHASE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 3. Insert review
    const { data: review, error: insertErr } = await serviceClient
      .from("reviews")
      .insert({
        product_id: sanitizedProductId,
        user_id: authUser.id,
        order_id: verifiedOrderId,
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        title: sanitizedTitle,
        body: sanitizedBody.trim(),
        is_approved: true, // Auto-approve verified buyer reviews
      })
      .select("id, product_id, rating, title, body, created_at")
      .single();

    if (insertErr) {
      return dbError(insertErr, "INSERT_FAILED", 500);
    }

    return NextResponse.json({ success: true, data: review });
  } catch (err: any) {
    return serverError(err);
  }
});

