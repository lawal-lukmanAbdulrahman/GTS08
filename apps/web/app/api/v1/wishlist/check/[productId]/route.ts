import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { getAuthenticatedUser } from "../../../auth/utils";
import { noStore } from "../../../_lib/cart";
import { serverError } from "../../../_lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { productId } = await params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Choose a product.", code: "VALIDATION_ERROR" }, { status: 400 });
    const { data, error } = await createServiceClient().from("wishlists").select("id").eq("user_id", user.id).eq("product_id", productId).maybeSingle();
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { is_wishlisted: !!data } }, noStore);
  } catch (err) {
    return serverError(err);
  }
}
