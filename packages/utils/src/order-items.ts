const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_LINE_QUANTITY = 999;
export const MAX_ORDER_LINES = 50;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export interface OrderItem {
  variant_id: string;
  quantity: number;
}

export type OrderItemsValidation = { ok: true; items: OrderItem[] } | { ok: false; message: string };

/**
 * The cart lines a sale or WhatsApp order arrives with. Quantities must be
 * whole numbers from 1 up (a negative one would ADD stock), variants must be
 * real uuids (anything else can't exist and would only reach the database as an
 * error), and repeated lines for one variant are merged so stock is checked
 * against the total. Shared by every route that takes cart lines.
 */
export function validateOrderItems(input: unknown): OrderItemsValidation {
  if (!Array.isArray(input)) return { ok: false, message: "items must be a list." };
  if (input.length > MAX_ORDER_LINES) return { ok: false, message: `An order can have at most ${MAX_ORDER_LINES} lines.` };

  const merged = new Map<string, number>();
  for (let i = 0; i < input.length; i++) {
    const line = input[i] as Record<string, unknown> | null;
    const n = i + 1;
    if (typeof line !== "object" || line === null) return { ok: false, message: `Item ${n} is not valid.` };
    if (!isUuid(line.variant_id)) return { ok: false, message: `Item ${n} has an invalid product variant.` };
    const q = line.quantity;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1) return { ok: false, message: `Item ${n} needs a whole quantity of 1 or more.` };
    const total = (merged.get(line.variant_id) ?? 0) + q;
    if (total > MAX_LINE_QUANTITY) return { ok: false, message: `Item ${n} is over the limit of ${MAX_LINE_QUANTITY} per product.` };
    merged.set(line.variant_id, total);
  }
  return { ok: true, items: [...merged].map(([variant_id, quantity]) => ({ variant_id, quantity })) };
}
