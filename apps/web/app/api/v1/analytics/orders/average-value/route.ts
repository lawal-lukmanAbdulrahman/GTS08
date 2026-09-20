import type { NextRequest } from "next/server";
import { requireAdmin } from "../../../_lib/staff-access";
import { analytics, loadPaidOrders } from "../../../_lib/analytics-route";
import { summarize } from "../../../_lib/analytics";

/** Average order value (kobo), overall and per channel. */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  return analytics(request, async ({ client, period }) => {
    const orders = await loadPaidOrders(client, period.from, period.to);
    const avg = (channel: string) => summarize(orders.filter((o) => o.channel === channel)).average_order_value;
    return { period: period.key, average_order_value: summarize(orders).average_order_value, online: avg("online"), walk_in: avg("walk_in"), whatsapp: avg("whatsapp") };
  });
}
