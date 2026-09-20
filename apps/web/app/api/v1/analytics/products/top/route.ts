import type { NextRequest } from "next/server";
import { requireAdmin } from "../../../_lib/staff-access";
import { NextResponse } from "next/server";
import { analytics } from "../../../_lib/analytics-route";
import { PAID_STATUSES, rankProducts } from "../../../_lib/analytics";

const MAX_LIMIT = 50;

/** Best sellers by units in the period. Query: ?period=30d&limit=10 */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  const raw = request.nextUrl.searchParams.get("limit");
  const limit = raw === null ? 10 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json({ error: `limit must be a whole number from 1 to ${MAX_LIMIT}.`, code: "INVALID_LIMIT" }, { status: 400 });
  }
  return analytics(request, async ({ client, period }) => {
    const { data, error } = await client
      .from("order_items")
      .select("quantity, line_total, product_snapshot, order:orders!inner(status, created_at)")
      .in("order.status", PAID_STATUSES)
      .gte("order.created_at", period.from.toISOString())
      .lt("order.created_at", period.to.toISOString())
      .limit(50_000);
    if (error) throw new Error(error.message);
    return rankProducts((data ?? []) as Parameters<typeof rankProducts>[0], limit);
  });
}
