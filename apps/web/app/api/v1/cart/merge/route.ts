import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { badSession, ensureSession, MAX_LINE_QUANTITY, readCart, validSession } from "../../_lib/cart";
import { isPlainObject } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

/**
 * After signing in: folds the anonymous cart into the account's own cart, so
 * what the shopper picked before logging in isn't lost. Quantities are added
 * but never beyond what's in stock. The anonymous cart is then discarded.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });

  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const anon = isPlainObject(parsed.body) ? parsed.body.session_id : undefined;
    if (typeof anon !== "string" || !validSession(anon)) return badSession();

    const client = createServiceClient();
    const { data: own } = await client.from("cart_sessions").select("session_id, user_id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const target = (own as { session_id?: string } | null)?.session_id ?? crypto.randomUUID();
    await ensureSession(client, target, user.id);

    if (target !== anon) {
      const [from, into] = await Promise.all([readCart(client, anon), readCart(client, target)]);
      const have = new Map(into.lines.map((l) => [l.variant_id, l.quantity]));
      for (const line of from.lines) {
        if (!line.valid && line.available <= 0) continue;
        const merged = Math.min((have.get(line.variant_id) ?? 0) + line.quantity, line.available, MAX_LINE_QUANTITY);
        if (merged < 1) continue;
        const { error } = await client.from("cart_items").upsert({ session_id: target, variant_id: line.variant_id, quantity: merged }, { onConflict: "session_id,variant_id" });
        if (error) return serverError(new Error(error.message));
      }
      await client.from("cart_sessions").delete().eq("session_id", anon);
    }

    return NextResponse.json({ data: { session_id: target, ...(await readCart(client, target)) } });
  } catch (err) {
    return serverError(err);
  }
}
