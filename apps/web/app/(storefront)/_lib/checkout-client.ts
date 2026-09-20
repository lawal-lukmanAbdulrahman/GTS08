import type { CartItem } from "../_components/cart-context";

export interface CheckoutLine {
  product_slug: string;
  size: string | undefined;
  color: string | undefined;
  quantity: number;
}

/** What the cart sends the server: which product, which size and colour, how many. Never a price. */
export function toCheckoutLines(cart: Pick<CartItem, "product" | "size" | "color" | "quantity">[]): CheckoutLine[] {
  return cart.map((c) => ({
    product_slug: c.product.id,
    size: c.size || undefined,
    color: c.color || undefined,
    quantity: c.quantity,
  }));
}

export interface QuoteLine {
  variant_id: string;
  product_slug: string;
  name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  available: number;
  in_stock: boolean;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number; // kobo
  delivery_fees: Record<"door" | "pickup" | "express", number>; // kobo
  all_available: boolean;
}

export interface PaidOrder {
  order_number: string;
  paid: boolean;
  status?: string;
  subtotal?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total: number;
  created_at?: string;
  items: Array<{ name: string; size: string | null; color: string | null; quantity: number; unit_price: number; line_total: number }>;
}

export type PromoCheck = { ok: true; code: string; discount: number } | { ok: false; message: string };

/** Asks the server what a code takes off the server's own subtotal (kobo). Advice for the display; checkout re-checks it. */
export async function checkPromo(code: string, subtotalKobo: number): Promise<PromoCheck> {
  if (!code.trim()) return { ok: false, message: "Enter a promo code." };
  try {
    const res = await fetch("/api/v1/promos/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, cart_total: subtotalKobo }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.data) return { ok: true, code: body.data.code, discount: body.data.discount };
    if (body?.code === "MIN_ORDER" && typeof body?.details?.short_by === "number") {
      return { ok: false, message: `Add ₦${(body.details.short_by / 100).toLocaleString()} more to use this code.` };
    }
    return { ok: false, message: body?.error || "That promo code isn't valid." };
  } catch {
    return { ok: false, message: "We couldn't check that code. Please try again." };
  }
}
