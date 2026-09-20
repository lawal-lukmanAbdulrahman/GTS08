import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";

/** Removes a product from the signed-in user's wishlist. Only ever their own entry. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { productId } = await params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Choose a product.", code: "VALIDATION_ERROR" }, { status: 400 });
    const { error } = await createServiceClient().from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { product_id: productId, is_wishlisted: false } });
  } catch (err) {
    return serverError(err);
  }
}
