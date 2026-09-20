import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { badSession, ensureSession, MAX_CART_LINES, MAX_LINE_QUANTITY, noStore, readCart, toLine, validSession, VARIANT_SELECT, type VariantJoin } from "../../_lib/cart";
import { getAuthenticatedUser } from "../../auth/utils";
import { resolveCartLines } from "../../_lib/checkout-cart";
import { isPlainObject } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ sessionId: string }> };

/** The cart, priced and stock-checked live. A session nobody has used is simply empty. */
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { sessionId } = await params;
    if (!validSession(sessionId)) return badSession();
    return NextResponse.json({ data: { session_id: sessionId, ...(await readCart(createServiceClient(), sessionId)) } }, noStore);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * Replaces the cart with the lines the browser holds, so a cart kept in the
 * browser can also live on the server (and follow the shopper after they sign
 * in). Each line is resolved and capped to stock on its own; ones that can't
 * be matched are dropped and counted, never guessed at.
 */
export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const { sessionId } = await params;
    if (!validSession(sessionId)) return badSession();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const items = isPlainObject(parsed.body) ? parsed.body.items : undefined;
    if (!Array.isArray(items) || items.length > MAX_CART_LINES) {
      return NextResponse.json({ error: `Send a list of up to ${MAX_CART_LINES} items.`, code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const client = createServiceClient();
    const wanted = new Map<string, number>();
    let dropped = 0;
    for (const raw of items) {
      const line = isPlainObject(raw) ? raw : {};
      const r = await resolveCartLines(client, [{ variant_id: line.variant_id, product_slug: line.product_slug, size: line.size, color: line.color, quantity: line.quantity }]);
      if (!r.ok) {
        if (r.code === "DATABASE_ERROR") return serverError(new Error(r.message));
        dropped += 1;
        continue;
      }
      const { variant_id, quantity } = r.items[0]!;
      wanted.set(variant_id, Math.min(MAX_LINE_QUANTITY, (wanted.get(variant_id) ?? 0) + quantity));
    }

    const user = await getAuthenticatedUser(request);
    await ensureSession(client, sessionId, user?.id ?? null);
    const { error: clearError } = await client.from("cart_items").delete().eq("session_id", sessionId);
    if (clearError) return serverError(new Error(clearError.message));

    if (wanted.size > 0) {
      // Cap each line to what's in stock right now, before anything is written.
      const { data: variants, error: variantError } = await client.from("product_variants").select(VARIANT_SELECT).in("id", [...wanted.keys()]);
      if (variantError) return serverError(new Error(variantError.message));
      const stock = new Map(((variants ?? []) as unknown as VariantJoin[]).map((v) => [v.id, toLine(1, v, v.id).available]));
      const rows = [...wanted]
        .map(([variant_id, quantity]) => ({ session_id: sessionId, variant_id, quantity: Math.min(quantity, stock.get(variant_id) ?? 0) }))
        .filter((r) => r.quantity > 0);
      if (rows.length > 0) {
        const { error } = await client.from("cart_items").upsert(rows, { onConflict: "session_id,variant_id" });
        if (error) return serverError(new Error(error.message));
      }
    }
    return NextResponse.json({ data: { session_id: sessionId, ...(await readCart(client, sessionId)), dropped } }, noStore);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const { sessionId } = await params;
    if (!validSession(sessionId)) return badSession();
    const { error } = await createServiceClient().from("cart_items").delete().eq("session_id", sessionId);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { session_id: sessionId, lines: [], subtotal: 0, all_valid: true } });
  } catch (err) {
    return serverError(err);
  }
}
