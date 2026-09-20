import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requireAdmin } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import { PROMO_COLUMNS } from "../../../_lib/promo-db";
import { isPlainObject } from "../../../_lib/validate";
import { serverError } from "../../../_lib/http";

/** Switches a code on or off. Send { is_active } to set it; send nothing to flip it. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    const notFound = () => NextResponse.json({ error: "Promo code not found.", code: "NOT_FOUND" }, { status: 404 });
    if (!isUuid(id)) return notFound();

    let body: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
      }
    }
    const requested = isPlainObject(body) ? body.is_active : undefined;
    if (requested !== undefined && typeof requested !== "boolean") return NextResponse.json({ error: "Active must be true or false.", code: "VALIDATION_ERROR" }, { status: 400 });

    const client = createServiceClient();
    const { data: current, error } = await client.from("promos").select("id, is_active").eq("id", id).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!current) return notFound();

    const next = requested ?? !(current as { is_active: boolean }).is_active;
    const { data, error: updateError } = await client.from("promos").update({ is_active: next }).eq("id", id).select(PROMO_COLUMNS).maybeSingle();
    if (updateError) return serverError(new Error(updateError.message));
    await logActivity(client, { actorId: admin.user.id, action: "promo.update", targetType: "promo", targetId: id, changes: { is_active: next }, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}
