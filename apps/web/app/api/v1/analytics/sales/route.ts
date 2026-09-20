import type { NextRequest } from "next/server";
import { requireAdmin } from "../../_lib/staff-access";
import { NextResponse } from "next/server";
import { analytics, loadPaidOrders } from "../../_lib/analytics-route";
import { dailySeries } from "../../_lib/analytics";

const CHANNELS = ["online", "walk_in", "whatsapp"];

/** Revenue per Lagos day. Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (or ?period=) and optionally &channel=online|walk_in|whatsapp. */
export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if (!access.ok) return access.response;
  const channel = request.nextUrl.searchParams.get("channel") ?? undefined;
  if (channel && !CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `channel must be one of: ${CHANNELS.join(", ")}.`, code: "INVALID_CHANNEL" }, { status: 400 });
  }
  return analytics(request, async ({ client, period }) => dailySeries(await loadPaidOrders(client, period.from, period.to, channel), period.from, period.to));
}
