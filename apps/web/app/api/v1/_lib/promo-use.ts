type Client = { from(table: string): any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Counts a promo code as used when its order is paid (not when the order is
 * only placed, so abandoned checkouts don't burn a limited code). Once per
 * order however often payment is reported, and it never throws: the customer
 * has paid, and a counting problem must not turn that into an error.
 */
export async function consumePromo(client: Client, o: { code: string | null; orderId: string }): Promise<void> {
  if (!o.code) return;
  try {
    const { data: promo, error } = await client.from("promos").select("id, used_count").eq("code", o.code).maybeSingle();
    if (error || !promo) {
      if (error) console.error("[promo-use] lookup failed:", error.message);
      return;
    }
    const { data: existing } = await client.from("promo_code_uses").select("id").eq("promo_id", promo.id).eq("order_id", o.orderId).limit(1);
    if (Array.isArray(existing) && existing.length > 0) return;

    const { error: useError } = await client.from("promo_code_uses").insert({ promo_id: promo.id, order_id: o.orderId });
    if (useError) return void console.error("[promo-use] insert failed:", useError.message);
    const { error: countError } = await client.from("promos").update({ used_count: promo.used_count + 1 }).eq("id", promo.id).eq("used_count", promo.used_count);
    if (countError) console.error("[promo-use] count failed:", countError.message);
  } catch (err) {
    console.error("[promo-use] failed:", err);
  }
}
