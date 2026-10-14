type Client = { from(table: string): any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Counts a promo code as used when its order is paid (not when the order is
 * only placed, so abandoned checkouts don't burn a limited code). Once per
 * order however often payment is reported, and it never throws: the customer
 * has paid, and a counting problem must not turn that into an error.
 */
export async function consumePromo(
  client: Client,
  o: {
    code: string | null;
    orderId: string;
    customerId?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
    discountAppliedKobo?: number;
  }
): Promise<void> {
  if (!o.code) return;
  try {
    const { data: promo, error } = await client.from("promos").select("id, used_count").eq("code", o.code).maybeSingle();
    if (error || !promo) {
      if (error) console.error("[promo-use] lookup failed:", error.message);
      return;
    }
    const { data: existing } = await client.from("promo_code_uses").select("id").eq("promo_id", promo.id).eq("order_id", o.orderId).limit(1);
    if (Array.isArray(existing) && existing.length > 0) return;

    let custId = o.customerId || null;
    let custEmail = o.customerEmail || null;
    let custName = o.customerName || null;
    let discountKobo = o.discountAppliedKobo || 0;

    if (!custId || !custEmail) {
      const { data: order } = await client.from("orders").select("customer_id, discount_amount").eq("id", o.orderId).maybeSingle();
      if (order) {
        if (!custId && order.customer_id) custId = order.customer_id;
        if (!discountKobo && order.discount_amount) discountKobo = order.discount_amount;
      }
    }

    if (custId && (!custEmail || !custName)) {
      const { data: cust } = await client.from("customers").select("first_name, last_name, email").eq("id", custId).maybeSingle();
      if (cust) {
        if (!custEmail) custEmail = cust.email;
        if (!custName) custName = `${cust.first_name || ""} ${cust.last_name || ""}`.trim() || cust.email;
      }
    }

    const { error: useError } = await client.from("promo_code_uses").insert({
      promo_id: promo.id,
      order_id: o.orderId,
      customer_id: custId,
      customer_email: custEmail,
      customer_name: custName,
      discount_applied_kobo: discountKobo,
    });
    if (useError) return void console.error("[promo-use] insert failed:", useError.message);
    const { error: countError } = await client.from("promos").update({ used_count: promo.used_count + 1 }).eq("id", promo.id).eq("used_count", promo.used_count);
    if (countError) console.error("[promo-use] count failed:", countError.message);
  } catch (err) {
    console.error("[promo-use] failed:", err);
  }
}
