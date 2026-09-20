import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { getAuthenticatedUser } from "../auth/utils";
import { noStore } from "../_lib/cart";
import { isPlainObject, SLUG } from "../_lib/validate";
import { readJson, serverError } from "../_lib/http";
import { variantAvailable } from "../pos/_lib/stock-status";

const unauthorized = () => NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });

interface Row {
  added_at: string;
  product: { id: string; name: string; slug: string; base_price: number; status: string; primary_image?: unknown; variants: Array<{ is_active: boolean; inventory: { quantity: number; reserved_quantity: number } | null }> | null } | null;
}

/** The signed-in user's saved products. Only their own, and only ones still on sale. */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  try {
    const { data, error } = await createServiceClient()
      .from("wishlists")
      .select("added_at, product:products(id, name, slug, base_price, status, variants:product_variants(is_active, inventory(quantity, reserved_quantity)))")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })
      .limit(200);
    if (error) return serverError(new Error(error.message));
    const items = ((data ?? []) as unknown as Row[])
      .filter((r) => r.product && r.product.status === "active")
      .map((r) => ({
        product_id: r.product!.id,
        name: r.product!.name,
        slug: r.product!.slug,
        price: r.product!.base_price,
        added_at: r.added_at,
        in_stock: (r.product!.variants ?? []).some((v) => v.is_active && v.inventory && variantAvailable(v.inventory) > 0),
      }));
    return NextResponse.json({ data: items }, noStore);
  } catch (err) {
    return serverError(err);
  }
}

/** Saves a product for the signed-in user. Saving it twice changes nothing. */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const b = isPlainObject(parsed.body) ? parsed.body : {};
    // The storefront knows a product by its slug; other callers may use the id.
    const byId = isUuid(b.product_id);
    const bySlug = typeof b.product_slug === "string" && SLUG.test(b.product_slug);
    if (!byId && !bySlug) return NextResponse.json({ error: "Choose a product to save.", code: "VALIDATION_ERROR" }, { status: 400 });

    const client = createServiceClient();
    const { data: product } = await client.from("products").select("id, status").eq(byId ? "id" : "slug", (byId ? b.product_id : b.product_slug) as string).maybeSingle();
    if (!product || (product as { status: string }).status !== "active") return NextResponse.json({ error: "Product not found.", code: "NOT_FOUND" }, { status: 404 });
    const productId = (product as { id: string }).id;

    const { error } = await client.from("wishlists").upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" });
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { product_id: productId, is_wishlisted: true } });
  } catch (err) {
    return serverError(err);
  }
}
