import type { NextRequest } from "next/server";
import { requireAdmin } from "../../_lib/staff-access";
import { analytics, loadPaidOrders } from "../../_lib/analytics-route";
import { PAID_STATUSES, pctChange, summarize } from "../../_lib/analytics";

/**
 * The admin dashboard's numbers. `kpis`, `recent_orders` and `top_products` are
 * all-time and unchanged; `revenue`, `orders`, `average_order_value` and the
 * rest are for the chosen period (?period=today|7d|30d|custom), each compared
 * with the period of equal length just before it.
 */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  return analytics(request, async ({ client, period }) => {
    const [current, previous] = await Promise.all([
      loadPaidOrders(client, period.from, period.to),
      loadPaidOrders(client, period.prevFrom, period.prevTo),
    ]);
    const now = summarize(current);
    const before = summarize(previous);

    const { data: revenueData } = await client.from("orders").select("total").in("status", PAID_STATUSES);
    const totalRevenueKobo = (revenueData || []).reduce((acc: number, curr: { total?: number }) => acc + (curr.total || 0), 0);
    const { count: totalOrders } = await client.from("orders").select("*", { count: "exact", head: true });
    const { data: inventoryList } = await client.from("inventory").select("quantity, reserved_quantity, low_stock_threshold");
    const lowStock = (inventoryList || []).filter((i: { quantity: number; reserved_quantity: number; low_stock_threshold: number }) => i.quantity - i.reserved_quantity <= i.low_stock_threshold).length;
    const { count: totalCustomers } = await client.from("users").select("*", { count: "exact", head: true }).eq("role", "customer");
    const { count: newCustomers } = await client
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", period.from.toISOString())
      .lt("created_at", period.to.toISOString());
    const { data: toShip } = await client.from("orders").select("id").eq("channel", "online").in("status", ["paid", "confirmed"]).limit(5000);
    const { data: recentOrders } = await client
      .from("orders")
      .select("id, order_number, channel, status, total, created_at, customer:customers(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(5);
    const { data: topProducts } = await client
      .from("products")
      .select("id, name, slug, base_price, total_sold, category:categories(name)")
      .order("total_sold", { ascending: false })
      .limit(5);

    return {
      period: period.key,
      revenue: { ...now.revenue, change_pct: pctChange(now.revenue.total, before.revenue.total) },
      orders: { ...now.orders, change_pct: pctChange(now.orders.total, before.orders.total) },
      average_order_value: now.average_order_value,
      new_customers: newCustomers ?? 0,
      orders_awaiting_shipment: Array.isArray(toShip) ? toShip.length : 0,
      low_stock_variants: lowStock,
      kpis: {
        total_revenue_kobo: totalRevenueKobo,
        total_revenue_naira: totalRevenueKobo / 100,
        total_orders: totalOrders || 0,
        low_stock_count: lowStock,
        total_customers: totalCustomers || 0,
      },
      recent_orders: recentOrders || [],
      top_products: topProducts || [],
    };
  });
}
