import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { requireAdmin } from "../../_lib/staff-access";
import { serverError } from "../../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if (!access.ok) return access.response;

    const serviceClient = createServiceClient();

    // Fetch total revenue
    const { data: revenueData } = await serviceClient
      .from("orders")
      .select("total")
      .in("status", ["paid", "confirmed", "processing", "shipped", "delivered", "completed"]);

    const totalRevenueKobo = (revenueData || []).reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);

    // Fetch total orders count
    const { count: totalOrders } = await serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true });

    // Fetch low stock count
    const { data: inventoryList } = await serviceClient.from("inventory").select("quantity, reserved_quantity, low_stock_threshold");
    const lowStockCount = (inventoryList || []).filter(
      (inv: any) => inv.quantity - inv.reserved_quantity <= inv.low_stock_threshold
    ).length;

    // Fetch total customers count
    const { count: totalCustomers } = await serviceClient
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer");

    // Fetch recent 5 orders
    const { data: recentOrders } = await serviceClient
      .from("orders")
      .select("id, order_number, channel, status, total, created_at, customer:customers(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch top 5 bestselling products
    const { data: topProducts } = await serviceClient
      .from("products")
      .select("id, name, slug, base_price, total_sold, category:categories(name)")
      .order("total_sold", { ascending: false })
      .limit(5);

    return NextResponse.json({
      data: {
        kpis: {
          total_revenue_kobo: totalRevenueKobo,
          total_revenue_naira: totalRevenueKobo / 100,
          total_orders: totalOrders || 0,
          low_stock_count: lowStockCount,
          total_customers: totalCustomers || 0,
        },
        recent_orders: recentOrders || [],
        top_products: topProducts || [],
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
