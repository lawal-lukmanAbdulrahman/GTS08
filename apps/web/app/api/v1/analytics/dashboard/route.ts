import type { NextRequest } from "next/server";
import { requireAdmin } from "../../_lib/staff-access";
import { analytics } from "../../_lib/analytics-route";
import { PAID_STATUSES } from "../../_lib/analytics";
import { buildDashboard, type DashboardInput } from "../../_lib/dashboard-figures";

const LIMIT = 20_000;

/** Throws on a database error; the analytics shell turns it into a safe 500. */
function rows<T>(result: { data: unknown; error: { message?: string } | null }): T[] {
  if (result.error) throw new Error(result.error.message ?? "database error");
  return (result.data ?? []) as T[];
}

/**
 * Every figure on the admin dashboard, from real records (?period=7d|30d, default 7d).
 * The service client scopes each table to the caller's data set, so the demo
 * account sees demo figures and everyone else the live shop's.
 */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  return analytics(request, async ({ client, period }) => {
    const iso = (d: Date) => d.toISOString();
    const [orders, previousOrders, paidCustomers, transactions, products, stock, views, recent] = await Promise.all([
      client
        .from("orders")
        .select("id, total, channel, status, payment_status, created_at, customer_id, cashier_id, discount_amount, promo_code, items:order_items(quantity, line_total, product_snapshot)")
        .gte("created_at", iso(period.from))
        .lt("created_at", iso(period.to))
        .limit(LIMIT),
      client.from("orders").select("total, channel, status, payment_status, created_at").gte("created_at", iso(period.prevFrom)).lt("created_at", iso(period.prevTo)).limit(LIMIT),
      client.from("orders").select("customer_id").or(`status.in.(${PAID_STATUSES.join(",")}),payment_status.eq.paid`).not("customer_id", "is", null).limit(50_000),
      client.from("transactions").select("payment_method, payment_status, amount, created_at").gte("created_at", iso(period.prevFrom)).lt("created_at", iso(period.to)).limit(LIMIT),
      client.from("products").select("id, name, base_price, cost_price, status, category:categories(name)").limit(5_000),
      client.from("inventory").select("quantity, reserved_quantity, variant:product_variants(product_id)").limit(LIMIT),
      client.from("product_views").select("session_id, event_type, created_at").gte("created_at", iso(period.prevFrom)).lt("created_at", iso(period.to)).limit(100_000),
      client.from("orders").select("id, order_number, channel, status, payment_status, total, created_at, customer:customers(full_name, email)").order("created_at", { ascending: false }).limit(5),
    ]);

    const current = rows<DashboardInput["orders"][number]>(orders);
    const cashierIds = [...new Set(current.map((o) => o.cashier_id).filter((id): id is string => !!id))];
    const staff = cashierIds.length ? rows<DashboardInput["staff"][number]>(await client.from("users").select("id, full_name").in("id", cashierIds)) : [];

    // Compare instants, not strings: Postgres writes +00:00 where JavaScript writes Z.
    const inPeriod = (t: { created_at: string }) => new Date(t.created_at).getTime() >= period.from.getTime();
    const allTxns = rows<DashboardInput["transactions"][number]>(transactions);
    const allViews = rows<DashboardInput["views"][number]>(views);

    const data = buildDashboard({
      period,
      now: new Date(),
      orders: current,
      previousOrders: rows(previousOrders),
      paidCustomerIds: rows<{ customer_id: string | null }>(paidCustomers).map((r) => r.customer_id),
      transactions: allTxns.filter(inPeriod),
      previousTransactions: allTxns.filter((t) => !inPeriod(t)),
      products: rows(products),
      stock: rows<{ quantity: number; reserved_quantity: number; variant: { product_id: string } | null }>(stock)
        .filter((s) => s.variant?.product_id)
        .map((s) => ({ product_id: s.variant!.product_id, quantity: s.quantity, reserved_quantity: s.reserved_quantity })),
      views: allViews.filter(inPeriod),
      previousViews: allViews.filter((v) => !inPeriod(v)),
      staff,
    });
    return { ...data, recent_orders: rows(recent) };
  });
}
