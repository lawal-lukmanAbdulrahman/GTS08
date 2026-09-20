/** A payment a staff member took, with the order it belongs to. Amounts are kobo. */
export interface SaleRow {
  amount: number;
  payment_method: string;
  created_at: string;
  order: {
    order_number: string;
    channel: string;
    status: string;
    discount_amount: number;
  };
}

interface Tally {
  count: number;
  total: number;
}

export interface SalesSummary {
  sales: Tally & { average: number };
  by_payment_method: { cash: Tally; pos_terminal: Tally };
  by_channel: { walk_in: Tally; whatsapp: Tally };
  voided: Tally;
  discounts_given: Tally;
}

const tally = (): Tally => ({ count: 0, total: 0 });

/**
 * A staff member's sales record. A sale is credited to whoever took the
 * payment. Voided sales are reported separately and never count toward
 * totals; payments on other order states (e.g. cancelled) are ignored.
 */
export function summariseSales(rows: SaleRow[]): SalesSummary {
  const sales = tally();
  const voided = tally();
  const discounts = tally();
  const byMethod = { cash: tally(), pos_terminal: tally() };
  const byChannel = { walk_in: tally(), whatsapp: tally() };

  for (const row of rows) {
    if (row.order.status === "voided") {
      voided.count += 1;
      voided.total += row.amount;
      continue;
    }
    if (row.order.status !== "completed") continue;

    sales.count += 1;
    sales.total += row.amount;

    const method = byMethod[row.payment_method as keyof typeof byMethod];
    if (method) {
      method.count += 1;
      method.total += row.amount;
    }
    const channel = byChannel[row.order.channel as keyof typeof byChannel];
    if (channel) {
      channel.count += 1;
      channel.total += row.amount;
    }
    if (row.order.discount_amount > 0) {
      discounts.count += 1;
      discounts.total += row.order.discount_amount;
    }
  }

  return {
    sales: { ...sales, average: sales.count ? Math.round(sales.total / sales.count) : 0 },
    by_payment_method: byMethod,
    by_channel: byChannel,
    voided,
    discounts_given: discounts,
  };
}
