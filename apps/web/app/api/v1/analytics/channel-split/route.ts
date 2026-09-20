import type { NextRequest } from "next/server";
import { requireAdmin } from "../../_lib/staff-access";
import { analytics, loadPaidOrders } from "../../_lib/analytics-route";

/** Revenue and order count for each way of selling. */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  return analytics(request, async ({ client, period }) => {
    const split = { online: { revenue: 0, orders: 0 }, walk_in: { revenue: 0, orders: 0 }, whatsapp: { revenue: 0, orders: 0 } };
    for (const o of await loadPaidOrders(client, period.from, period.to)) {
      const bucket = o.channel === "online" ? split.online : o.channel === "whatsapp" ? split.whatsapp : split.walk_in;
      bucket.revenue += o.total;
      bucket.orders += 1;
    }
    return split;
  });
}
