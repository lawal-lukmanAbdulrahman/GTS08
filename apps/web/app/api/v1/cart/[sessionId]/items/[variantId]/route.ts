import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { firstVariant, badSession, MAX_LINE_QUANTITY, readCart, toLine, validSession, VARIANT_SELECT } from "../../../../_lib/cart";
import { isPlainObject } from "../../../../_lib/validate";
import { readJson, serverError } from "../../../../_lib/http";

type Context = { params: Promise<{ sessionId: string; variantId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const { sessionId, variantId } = await params;
    if (!validSession(sessionId) || !isUuid(variantId)) return badSession();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const quantity = isPlainObject(parsed.body) ? parsed.body.quantity : undefined;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Quantity must be a whole number of 1 or more. To remove an item, delete it.", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const client = createServiceClient();
    const { data, error } = await client.from("product_variants").select(VARIANT_SELECT).in("id", [variantId]);
    if (error) return serverError(new Error(error.message));
    const line = toLine(quantity, firstVariant(data), variantId);
    if (quantity > Math.min(line.available, MAX_LINE_QUANTITY)) {
      return NextResponse.json({ error: `Only ${line.available} available.`, code: "INSUFFICIENT_STOCK", details: { available: line.available } }, { status: 409 });
    }

    const { error: updateError } = await client.from("cart_items").update({ quantity }).eq("session_id", sessionId).eq("variant_id", variantId);
    if (updateError) return serverError(new Error(updateError.message));
    return NextResponse.json({ data: { session_id: sessionId, ...(await readCart(client, sessionId)) } });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const { sessionId, variantId } = await params;
    if (!validSession(sessionId) || !isUuid(variantId)) return badSession();
    const client = createServiceClient();
    const { error } = await client.from("cart_items").delete().eq("session_id", sessionId).eq("variant_id", variantId);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { session_id: sessionId, ...(await readCart(client, sessionId)) } });
  } catch (err) {
    return serverError(err);
  }
}
