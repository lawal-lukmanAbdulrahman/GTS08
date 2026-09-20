import type { InventoryClient } from "./inventory";

/**
 * Moves an order from one status to another only if it is still in `from`.
 * The WHERE status = from clause makes it a compare-and-swap, so a cashier
 * confirming an order while someone else cancels it can't both succeed and
 * double-apply stock changes.
 */
export async function transitionOrderStatus(
  client: InventoryClient,
  orderId: string,
  from: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await client
    .from("orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", from)
    .select("id");

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length === 1;
}
