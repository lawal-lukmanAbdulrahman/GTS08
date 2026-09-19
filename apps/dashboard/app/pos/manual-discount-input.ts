import { checkManualDiscount, formatKobo, parseNairaInput } from "@gts/utils";

export interface ResolvedDiscount {
  /** The discount to apply, in kobo. 0 when nothing (valid) was typed. */
  kobo: number;
  /** Why what was typed can't be used, or null. */
  error: string | null;
}

/**
 * What the cashier typed in the discount box, as exact kobo, judged by the
 * same rules the server enforces. The cart shows this and the sale sends it,
 * so the two can't disagree; the server still decides for real.
 */
export function resolveManualDiscount(
  text: string,
  ctx: { subtotal: number; isAdmin: boolean; canApply: boolean }
): ResolvedDiscount {
  if (!text.trim()) return { kobo: 0, error: null };

  const kobo = parseNairaInput(text);
  if (kobo === null) return { kobo: 0, error: "Enter a valid amount, like 500 or 500.50." };

  const check = checkManualDiscount({ amount: kobo, subtotal: ctx.subtotal, isAdmin: ctx.isAdmin, canApply: ctx.canApply });
  if (check.ok) return { kobo, error: null };

  const limit = check.maxAmount === undefined ? "" : ` (most: ${formatKobo(check.maxAmount)})`;
  return { kobo: 0, error: `${check.message}${limit}` };
}
