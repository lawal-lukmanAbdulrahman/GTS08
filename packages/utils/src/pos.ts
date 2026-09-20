export interface PosCartLine {
  unitPrice: number; // kobo
  quantity: number;
}

export interface PosCartTotals {
  subtotal: number; // kobo
  discountAmount: number; // kobo
  total: number; // kobo
}

/**
 * Pure cart math for the POS. All amounts are integer kobo — never Naira
 * floats. Shared between the POS API routes (apps/web) and the POS UI
 * (apps/dashboard) so cart totals never diverge between what the cashier
 * sees live and what the server computes authoritatively at confirmation.
 */
export function computeCartTotals(
  lines: PosCartLine[],
  discountAmount: number
): PosCartTotals {
  if (!lines || lines.length === 0) {
    throw new Error("Cart is empty.");
  }

  let subtotal = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Invalid quantity: ${line.quantity}`);
    }
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error(`Invalid unit price: ${line.unitPrice}`);
    }
    subtotal += line.unitPrice * line.quantity;
  }

  const safeDiscount = Math.max(0, Math.min(discountAmount || 0, subtotal));
  const total = subtotal - safeDiscount;

  return { subtotal, discountAmount: safeDiscount, total };
}
