import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../../auth/utils";
import { firstVariant, badSession, ensureSession, MAX_CART_LINES, MAX_LINE_QUANTITY, readCart, toLine, validSession, VARIANT_SELECT } from "../../../_lib/cart";
import { resolveCartLines } from "../../../_lib/checkout-cart";
import { isPlainObject } from "../../../_lib/validate";
import { readJson, serverError } from "../../../_lib/http";

/** Adds a product to the cart: by variant id, or by product slug + size + colour. Checks stock, including what's already in the cart. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    if (!validSession(sessionId)) return badSession();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = isPlainObject(parsed.body) ? parsed.body : {};

    const client = createServiceClient();
    const resolved = await resolveCartLines(client, [{ variant_id: body.variant_id, product_slug: body.product_slug, size: body.size, color: body.color, quantity: body.quantity }]);
    if (!resolved.ok) return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.code === "DATABASE_ERROR" ? 500 : 400 });
    const { variant_id: variantId, quantity } = resolved.items[0]!;

    const { data: variantRows, error: variantError } = await client.from("product_variants").select(VARIANT_SELECT).in("id", [variantId]);
    if (variantError) return serverError(new Error(variantError.message));
    const variant = firstVariant(variantRows);
    if (!toLine(1, variant, variantId).name || !variant || !variant.is_active || variant.product?.status !== "active") {
      return NextResponse.json({ error: "That item isn't available.", code: "ITEM_UNAVAILABLE" }, { status: 400 });
    }

    const { data: existing } = await client.from("cart_items").select("quantity").eq("session_id", sessionId).eq("variant_id", variantId).maybeSingle();
    const already = (existing as { quantity?: number } | null)?.quantity ?? 0;
    if (!existing) {
      const { data: lines } = await client.from("cart_items").select("variant_id").eq("session_id", sessionId);
      if (Array.isArray(lines) && lines.length >= MAX_CART_LINES) {
        return NextResponse.json({ error: `A cart can hold at most ${MAX_CART_LINES} different products.`, code: "CART_FULL" }, { status: 409 });
      }
    }

    const total = already + quantity;
    const available = toLine(total, variant, variantId).available;
    if (total > Math.min(available, MAX_LINE_QUANTITY)) {
      return NextResponse.json(
        { error: available === 0 ? "That item is out of stock." : `Only ${available} available${already ? `, and you already have ${already} in your cart` : ""}.`, code: "INSUFFICIENT_STOCK", details: { available, in_cart: already } },
        { status: 409 }
      );
    }

    const user = await getAuthenticatedUser(request);
    await ensureSession(client, sessionId, user?.id ?? null);
    const { error } = await client.from("cart_items").upsert({ session_id: sessionId, variant_id: variantId, quantity: total }, { onConflict: "session_id,variant_id" });
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { session_id: sessionId, ...(await readCart(client, sessionId)) } });
  } catch (err) {
    return serverError(err);
  }
}
