export interface RequestedLine {
  variantId: string;
  quantity: number;
}

export interface InsufficientLine {
  variantId: string;
  requested: number;
  available: number;
}

export type StockCheckResult =
  | { ok: true }
  | { ok: false; insufficient: InsufficientLine[] };

/**
 * gts_03_cashier_spec.md Part 8, rule 4: "Stock is re-validated at order
 * creation, not just at add-to-cart." `available` is keyed by variant_id.
 */
export function checkStockSufficiency(
  requested: RequestedLine[],
  available: Record<string, number>
): StockCheckResult {
  const insufficient: InsufficientLine[] = [];

  for (const line of requested) {
    const stock = available[line.variantId] ?? 0;
    if (stock < line.quantity) {
      insufficient.push({ variantId: line.variantId, requested: line.quantity, available: stock });
    }
  }

  return insufficient.length > 0 ? { ok: false, insufficient } : { ok: true };
}
