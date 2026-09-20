import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { isSlotKey, validateSlot } from "../../_lib/content-slots";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ key: string }> };
const notFound = () => NextResponse.json({ error: "Content slot not found.", code: "NOT_FOUND" }, { status: 404 });
const COLUMNS = "slot_key, headline, subheadline, cta_label, cta_link, image_cloudinary_id, mobile_image_cloudinary_id, is_active, start_date, end_date, updated_at";

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { key } = await params;
    if (!isSlotKey(key)) return notFound();
    const { data, error } = await createServiceClient().from("content_slots").select(COLUMNS).eq("slot_key", key).maybeSingle();
    if (error) return serverError(new Error(error.message));
    const slot = data as { is_active: boolean; start_date: string | null; end_date: string | null } | null;
    const now = Date.now();
    const live = !!slot && slot.is_active && (!slot.start_date || new Date(slot.start_date).getTime() <= now) && (!slot.end_date || new Date(slot.end_date).getTime() >= now);
    return live ? NextResponse.json({ data: slot }) : notFound();
  } catch (err) {
    return serverError(err);
  }
}

/** Creates or updates a slot. The key comes from the address, never the body. */
export async function PUT(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { key } = await params;
    if (!isSlotKey(key)) return notFound();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validateSlot(parsed.body);
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client
      .from("content_slots")
      .upsert({ ...check.value, slot_key: key, updated_by: admin.user.id, updated_at: new Date().toISOString() }, { onConflict: "slot_key" })
      .select(COLUMNS)
      .single();
    if (error) return serverError(new Error(error.message));
    await logActivity(client, { actorId: admin.user.id, action: "content_slot.update", targetType: "content_slot", changes: { key, fields: Object.keys(check.value) }, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}
