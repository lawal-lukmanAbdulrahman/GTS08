import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient, getDataMode, invalidateDataMode } from "@gts/database";
import { requireAdmin, requireSuperAdmin } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { dbError, readJson } from "../../_lib/http";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/** Which data the shop is showing: "live" (the real business) or "test" (the records made while building it). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const mode = await getDataMode();
  return NextResponse.json({ data: { mode, ready: mode !== null } });
}

/** Switches between test and live data. Nothing is deleted either way. Super admin only. */
export async function PUT(request: NextRequest) {
  const superAdmin = await requireSuperAdmin(request);
  if (!superAdmin.ok) return superAdmin.response;

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { mode?: unknown; confirm?: unknown } | null;
  if (body?.mode !== "test" && body?.mode !== "live") {
    return NextResponse.json({ error: "Choose test or live.", code: "INVALID_INPUT", field: "mode" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Confirm the switch before it is applied.", code: "CONFIRMATION_REQUIRED" }, { status: 400 });
  }

  const current = await getDataMode();
  if (!current) {
    return NextResponse.json({ error: "The database needs migration 00017 before test and live data can be separated.", code: "MIGRATION_REQUIRED" }, { status: 409 });
  }
  if (current === body.mode) return NextResponse.json({ data: { mode: current, ready: true } });

  const client = createServiceClient();
  const { error } = await client.from("settings").update({ data_mode: body.mode, updated_at: new Date().toISOString() }).eq("id", SETTINGS_ID);
  if (error) return dbError(error);
  invalidateDataMode();

  await logActivity(client, { actorId: superAdmin.user.id, action: "settings.data_mode", targetType: "settings", changes: { from: current, to: body.mode }, ip: clientIp(request) });
  return NextResponse.json({ data: { mode: body.mode, ready: true } });
}
