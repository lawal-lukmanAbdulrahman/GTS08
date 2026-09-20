/** Above this share of the subtotal only an admin may discount (cashier spec Part 4.2). */
export const MAX_CASHIER_DISCOUNT_PERCENT = 20;

export type ManualDiscountCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_DISCOUNT" | "PERMISSION_DENIED" | "DISCOUNT_LIMIT_EXCEEDED"; message: string; maxAmount?: number };

/**
 * Whether this staff member may take `amount` kobo off `subtotal` kobo.
 * Integer maths throughout: percentages are compared by cross-multiplying, so
 * no float ever touches money.
 */
export function checkManualDiscount(input: {
  amount: unknown;
  subtotal: number;
  isAdmin: boolean;
  canApply: boolean;
}): ManualDiscountCheck {
  const { amount, subtotal, isAdmin, canApply } = input;

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    return { ok: false, code: "INVALID_DISCOUNT", message: "A discount must be a whole, non-negative amount." };
  }
  if (amount === 0) return { ok: true };
  if (amount > subtotal) {
    return { ok: false, code: "INVALID_DISCOUNT", message: "A discount can't be more than the order subtotal." };
  }
  if (isAdmin) return { ok: true };

  if (!canApply) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: "You don't have permission to apply manual discounts. Ask an admin to grant it.",
    };
  }

  if (amount * 100 > subtotal * MAX_CASHIER_DISCOUNT_PERCENT) {
    return {
      ok: false,
      code: "DISCOUNT_LIMIT_EXCEEDED",
      message: `Discounts above ${MAX_CASHIER_DISCOUNT_PERCENT}% need an admin.`,
      maxAmount: Math.floor((subtotal * MAX_CASHIER_DISCOUNT_PERCENT) / 100),
    };
  }
  return { ok: true };
}
