import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";
import { SLUG } from "../../_lib/validate";

/** Removes a product from the signed-in user's wishlist. Only ever their own entry. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { productId } = await params;
    if (!isUuid(productId) && !SLUG.test(productId)) return NextResponse.json({ error: "Choose a product.", code: "VALIDATION_ERROR" }, { status: 400 });
    const client = createServiceClient();
    let id = productId;
    if (!isUuid(productId)) {
      const { data: product } = await client.from("products").select("id").eq("slug", productId).maybeSingle();
      if (!product) return NextResponse.json({ data: { product_id: null, is_wishlisted: false } });
      id = (product as { id: string }).id;
    }
    const { error } = await client.from("wishlists").delete().eq("user_id", user.id).eq("product_id", id);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { product_id: id, is_wishlisted: false } });
  } catch (err) {
    return serverError(err);
  }
}
