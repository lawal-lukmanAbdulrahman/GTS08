import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validateFlagUpdate } from "@gts/utils";
import { requireAdmin } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";

/** An admin reviews, resolves, dismisses or reopens a flag. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const check = validateFlagUpdate(body);
  if (!check.ok) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors },
      { status: 400 }
    );
  }
  const { status, resolution_note } = check.value;
  const closing = status === "resolved" || status === "dismissed";

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("product_flags")
    .update({
      status,
      resolution_note,
      resolved_by: closing ? admin.user.id : null,
      resolved_at: closing ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status, resolution_note, resolved_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Flag not found.", code: "FLAG_NOT_FOUND" }, { status: 404 });

  await logActivity(serviceClient, {
    actorId: admin.user.id,
    action: "product_flag.update",
    targetType: "product_flag",
    targetId: id,
    changes: { status },
    ip: clientIp(request),
  });

  return NextResponse.json({ data });
}
