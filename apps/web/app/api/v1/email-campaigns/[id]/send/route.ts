import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requireAdmin } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import { sendCampaign } from "../../../_lib/campaigns";
import { CAMPAIGN_COLUMNS } from "../../../_lib/campaign-db";
import { afterResponse } from "../../../_lib/email/after";
import { isPlainObject } from "../../../_lib/validate";
import { serverError } from "../../../_lib/http";

// A large audience takes a while to send after the response has gone out.
export const maxDuration = 300;

/** Sends a draft now, or schedules it. Body: { schedule_at?: ISO time in the future }. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Campaign not found.", code: "NOT_FOUND" }, { status: 404 });

    let body: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
      }
    }
    const rawAt = isPlainObject(body) ? body.schedule_at : undefined;
    let scheduleAt: string | null = null;
    if (rawAt !== undefined && rawAt !== null) {
      const t = typeof rawAt === "string" ? new Date(rawAt) : null;
      if (!t || Number.isNaN(t.getTime()) || t.getTime() <= Date.now() + 60_000) {
        return NextResponse.json({ error: "Choose a time at least a minute from now.", code: "VALIDATION_ERROR", details: { schedule_at: "Choose a future time." } }, { status: 400 });
      }
      scheduleAt = t.toISOString();
    }

    const client = createServiceClient();
    const { data, error } = await client.from("email_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return NextResponse.json({ error: "Campaign not found.", code: "NOT_FOUND" }, { status: 404 });
    const campaign = data as { status: string } & Record<string, unknown>;
    if (campaign.status !== "draft") return NextResponse.json({ error: "Only a draft can be sent or scheduled.", code: "NOT_A_DRAFT" }, { status: 409 });

    await logActivity(client, { actorId: admin.user.id, action: "campaign.send", targetType: "campaign", targetId: id, changes: { scheduled_at: scheduleAt }, ip: clientIp(request) });

    if (scheduleAt) {
      const { error: scheduleError } = await client.from("email_campaigns").update({ status: "scheduled", scheduled_at: scheduleAt }).eq("id", id).eq("status", "draft");
      if (scheduleError) return serverError(new Error(scheduleError.message));
      return NextResponse.json({ data: { id, status: "scheduled", scheduled_at: scheduleAt } });
    }

    afterResponse(() => sendCampaign(client, campaign as never));
    return NextResponse.json({ data: { id, status: "sending" } }, { status: 202 });
  } catch (err) {
    return serverError(err);
  }
}
