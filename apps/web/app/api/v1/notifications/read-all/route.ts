import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { serverError } from "../../_lib/http";

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { error } = await createServiceClient().from("admin_notifications").update({ is_read: true, read_by: admin.user.id }).eq("is_read", false);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return serverError(err);
  }
}
