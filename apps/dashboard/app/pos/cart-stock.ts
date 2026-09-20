import type { CartLine, PosProduct } from "./pos-types";

export interface Reconciled {
  lines: CartLine[];
  /** Plain sentences for the cashier about anything that was changed for them. */
  notices: string[];
}

const label = (l: CartLine) => `${l.productName}${[l.size, l.color].filter(Boolean).length ? ` (${[l.size, l.color].filter(Boolean).join(" / ")})` : ""}`;

/**
 * Brings the open sale in line with fresh stock numbers. Another till or an
 * online order can take stock while a sale is being rung up: a line that no
 * longer fits is lowered to what's left, or removed if it sold out, and the
 * cashier is told, instead of finding out from a refusal at payment.
 * Lines whose product isn't in `products` are left as they are.
 */
export function reconcileCartStock(lines: CartLine[], products: PosProduct[]): Reconciled {
  const fresh = new Map<string, number>();
  for (const p of products) for (const v of p.variants) fresh.set(v.id, v.available);

  const notices: string[] = [];
  let changed = false;
  const next: CartLine[] = [];

  for (const line of lines) {
    const available = fresh.get(line.variantId);
    if (available === undefined || available === line.available) {
      next.push(line);
      continue;
    }
    changed = true;
    if (available <= 0) {
      notices.push(`${label(line)} just sold out and was removed from this sale.`);
    } else if (line.quantity > available) {
      notices.push(`${label(line)}: only ${available} left, so the quantity was lowered to ${available}.`);
      next.push({ ...line, quantity: available, available });
    } else {
      next.push({ ...line, available });
    }
  }
  return { lines: changed ? next : lines, notices };
}
