import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireCron } from "../../_lib/cron";
import { sendCampaign } from "../../_lib/campaigns";
import { CAMPAIGN_COLUMNS } from "../../_lib/campaign-db";
import { serverError } from "../../_lib/http";

export const maxDuration = 300;

/** Sends scheduled campaigns whose time has come. Each is claimed first, so overlapping runs can't send one twice. */
export async function GET(request: NextRequest) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;
  try {
    const client = createServiceClient();
    const { data, error } = await client.from("email_campaigns").select(CAMPAIGN_COLUMNS).eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).limit(3);
    if (error) return serverError(new Error(error.message));

    let sent = 0;
    for (const campaign of (data ?? []) as Array<Record<string, unknown>>) {
      if (await sendCampaign(client, campaign as never)) sent += 1;
    }
    return NextResponse.json({ data: { campaigns_sent: sent } });
  } catch (err) {
    return serverError(err);
  }
}
