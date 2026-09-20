import { NextResponse } from "next/server";
import { isUuid, MAX_LINE_QUANTITY } from "@gts/utils";
import { variantAvailable } from "../pos/_lib/stock-status";

// The service client is untyped across this codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Client = { from(table: string): any };

export const MAX_CART_LINES = 50;
export { MAX_LINE_QUANTITY };

export const badSession = () => NextResponse.json({ error: "That cart isn't valid.", code: "INVALID_SESSION" }, { status: 400 });
export const noStore = { headers: { "Cache-Control": "no-store" } } as const;

/** A session id is the only key to an anonymous cart, so it must be a random UUID: nothing shorter or guessable is accepted. */
export const validSession = (id: string) => isUuid(id);

export interface VariantJoin {
  id: string;
  size: string | null;
  color: string | null;
  price_modifier: number;
  is_active: boolean;
  inventory: { quantity: number; reserved_quantity: number } | null;
  product: { id: string; name: string; slug: string; base_price: number; status: string } | null;
}

export interface CartLine {
  variant_id: string;
  product_slug: string | null;
  name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  available: number;
  valid: boolean;
}

export const VARIANT_SELECT = "id, size, color, price_modifier, is_active, inventory(quantity, reserved_quantity), product:products(id, name, slug, base_price, status)";

export function toLine(quantity: number, v: VariantJoin | null, variantId: string): CartLine {
  const sold = !!v && v.is_active && !!v.product && v.product.status === "active";
  const available = v?.inventory ? variantAvailable(v.inventory) : 0;
  const unit = sold ? v!.product!.base_price + v!.price_modifier : 0;
  return {
    variant_id: variantId,
    product_slug: v?.product?.slug ?? null,
    name: v?.product?.name ?? "Item no longer available",
    size: v?.size ?? null,
    color: v?.color ?? null,
    quantity,
    unit_price: unit,
    line_total: unit * quantity,
    available,
    valid: sold && quantity <= available,
  };
}

/** The cart's lines, priced and stock-checked from the database. Throws on a database error. */
export async function readCart(client: Client, sessionId: string) {
  const { data, error } = await client.from("cart_items").select(`variant_id, quantity, added_at, variant:product_variants(${VARIANT_SELECT})`).eq("session_id", sessionId).order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  const lines = ((data ?? []) as Array<{ variant_id: string; quantity: number; variant: VariantJoin | null }>).map((r) => toLine(r.quantity, r.variant, r.variant_id));
  return { lines, subtotal: lines.reduce((s, l) => s + l.line_total, 0), all_valid: lines.every((l) => l.valid) };
}

/** Makes sure the session row exists (the cart lines point at it), refreshing its expiry and attaching the owner if known. */
export async function ensureSession(client: Client, sessionId: string, userId: string | null): Promise<void> {
  const row: Record<string, unknown> = { session_id: sessionId, updated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() };
  if (userId) row.user_id = userId;
  const { error } = await client.from("cart_sessions").upsert(row, { onConflict: "session_id" });
  if (error) throw new Error(error.message);
}

/** The first variant row of a product_variants query, typed. */
export function firstVariant(data: unknown): VariantJoin | null {
  return ((data ?? []) as VariantJoin[])[0] ?? null;
}
