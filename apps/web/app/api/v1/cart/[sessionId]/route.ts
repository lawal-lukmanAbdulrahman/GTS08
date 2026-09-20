import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { badSession, noStore, readCart, validSession } from "../../_lib/cart";
import { serverError } from "../../_lib/http";

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
