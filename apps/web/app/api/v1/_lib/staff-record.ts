import { rangeStart, type SalesRange } from "@gts/utils";
import type { InventoryClient } from "../pos/_lib/inventory";
import { summariseSales, type SaleRow, type SalesSummary } from "./sales-summary";

export const SALES_RANGES: SalesRange[] = ["today", "week", "month"];

export interface RecentSale {
  order_number: string;
  channel: string;
  status: string;
  payment_method: string;
  amount: number;
  created_at: string;
}

export type SalesRecord =
  | { ok: true; range: SalesRange; since: string; summary: SalesSummary; recent: RecentSale[] }
  | { ok: false; message: string };

/**
 * Everything a staff member has taken payment for in a range. A sale is
 * credited to whoever took the payment (transactions.confirmed_by).
 */
export async function loadSalesRecord(client: InventoryClient, staffId: string, range: SalesRange): Promise<SalesRecord> {
  const since = rangeStart(range);
  const { data, error } = await client
    .from("transactions")
    .select("amount, payment_method, created_at, order:orders(order_number, channel, status, discount_amount)")
    .eq("confirmed_by", staffId)
    .eq("payment_status", "success")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) return { ok: false, message: error.message };

  const rows = ((data || []) as unknown as SaleRow[]).filter((r) => r.order);
  return {
    ok: true,
    range,
    since: since.toISOString(),
    summary: summariseSales(rows),
    recent: rows.slice(0, 20).map((r) => ({
      order_number: r.order.order_number,
      channel: r.order.channel,
      status: r.order.status,
      payment_method: r.payment_method,
      amount: r.amount,
      created_at: r.created_at,
    })),
  };
}

export interface ActivityEntryRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export type ActivityPage = { ok: true; data: ActivityEntryRow[] } | { ok: false; message: string };

/** A staff member's audit trail, newest first. The IP address is deliberately not exposed. */
export async function loadActivity(
  client: InventoryClient,
  staffId: string,
  opts: { limit?: number; before?: string | null } = {}
): Promise<ActivityPage> {
  const limit = Math.min(Math.max(1, opts.limit ?? 30), 100);
  let query = client
    .from("activity_logs")
    .select("id, action, target_type, target_id, changes, created_at")
    .eq("actor_id", staffId);
  if (opts.before && !Number.isNaN(Date.parse(opts.before))) query = query.lt("created_at", opts.before);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data || []) as ActivityEntryRow[] };
}
