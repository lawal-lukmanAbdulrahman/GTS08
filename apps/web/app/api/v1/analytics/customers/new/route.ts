import type { NextRequest } from "next/server";
import { requireAdmin } from "../../../_lib/staff-access";
import { analytics } from "../../../_lib/analytics-route";
import { pctChange } from "../../../_lib/analytics";

/** How many customers signed up in the period, against the one before. */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  return analytics(request, async ({ client, period }) => {
    const count = async (from: Date, to: Date) => {
      const { count: n, error } = await client
        .from("customers")
        .select("id", { count: "exact", head: true })
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString());
      if (error) throw new Error(error.message);
      return n ?? 0;
    };
    const [current, previous] = await Promise.all([count(period.from, period.to), count(period.prevFrom, period.prevTo)]);
    return { period: period.key, count: current, previous, change_pct: pctChange(current, previous) };
  });
}
