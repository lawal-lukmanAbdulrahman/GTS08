import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { badSession, noStore, readCart, validSession } from "../../../_lib/cart";
import { serverError } from "../../../_lib/http";

/** Stock check for every line, to run before showing the checkout button. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    if (!validSession(sessionId)) return badSession();
    const cart = await readCart(createServiceClient(), sessionId);
    return NextResponse.json(
      { data: { valid: cart.all_valid, items: cart.lines.map((l) => ({ variant_id: l.variant_id, requested: l.quantity, available: l.available, valid: l.valid })) } },
      noStore
    );
  } catch (err) {
    return serverError(err);
  }
}
