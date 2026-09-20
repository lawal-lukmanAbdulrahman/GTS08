import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../_lib/staff-access";
import { clientIp, logActivity } from "../_lib/activity";
import { validateCampaign } from "../_lib/campaigns";
import { CAMPAIGN_COLUMNS, withResult } from "../_lib/campaign-db";
import { readJson, serverError } from "../_lib/http";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { data, error } = await createServiceClient().from("email_campaigns").select(CAMPAIGN_COLUMNS).order("created_at", { ascending: false }).limit(200);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: ((data ?? []) as Array<{ audience_params?: unknown }>).map(withResult) });
  } catch (err) {
    return serverError(err);
  }
}

/** Creates a draft. Nothing is sent until it is sent on purpose. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validateCampaign(parsed.body, "create");
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client.from("email_campaigns").insert({ ...check.value, status: "draft", created_by: admin.user.id }).select(CAMPAIGN_COLUMNS).single();
    if (error) return serverError(new Error(error.message));
    await logActivity(client, { actorId: admin.user.id, action: "campaign.create", targetType: "campaign", targetId: (data as { id: string }).id, ip: clientIp(request) });
    return NextResponse.json({ data: withResult(data as { audience_params?: unknown }) }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
