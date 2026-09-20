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
