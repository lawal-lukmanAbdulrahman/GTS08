import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requireAdmin } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { validateCampaign } from "../../_lib/campaigns";
import { CAMPAIGN_COLUMNS, withResult } from "../../_lib/campaign-db";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Campaign not found.", code: "NOT_FOUND" }, { status: 404 });
const notDraft = () => NextResponse.json({ error: "Only a draft can be changed or deleted.", code: "NOT_A_DRAFT" }, { status: 409 });

async function load(id: string) {
  const { data, error } = await createServiceClient().from("email_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ({ status: string; audience_params?: unknown } & Record<string, unknown>) | null;
}

export async function GET(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const row = await load(id);
    return row ? NextResponse.json({ data: withResult(row) }) : notFound();
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validateCampaign(parsed.body, "update");
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });

    const current = await load(id);
    if (!current) return notFound();
    if (current.status !== "draft") return notDraft();

    const client = createServiceClient();
    const { data, error } = await client.from("email_campaigns").update(check.value).eq("id", id).eq("status", "draft").select(CAMPAIGN_COLUMNS).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return notDraft();
    await logActivity(client, { actorId: admin.user.id, action: "campaign.update", targetType: "campaign", targetId: id, ip: clientIp(request) });
    return NextResponse.json({ data: withResult(data as { audience_params?: unknown }) });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const current = await load(id);
    if (!current) return notFound();
    if (current.status !== "draft") return notDraft();
    const client = createServiceClient();
    const { error } = await client.from("email_campaigns").delete().eq("id", id).eq("status", "draft");
    if (error) return serverError(new Error(error.message));
    await logActivity(client, { actorId: admin.user.id, action: "campaign.delete", targetType: "campaign", targetId: id, ip: clientIp(request) });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (err) {
    return serverError(err);
  }
}
