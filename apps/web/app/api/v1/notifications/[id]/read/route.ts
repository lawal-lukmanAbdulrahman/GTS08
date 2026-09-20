import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requireAdmin } from "../../../_lib/staff-access";
import { serverError } from "../../../_lib/http";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    const notFound = () => NextResponse.json({ error: "Notification not found.", code: "NOT_FOUND" }, { status: 404 });
    if (!isUuid(id)) return notFound();
    const { data, error } = await createServiceClient().from("admin_notifications").update({ is_read: true, read_by: admin.user.id }).eq("id", id).select("id, is_read").maybeSingle();
    if (error) return serverError(new Error(error.message));
    return data ? NextResponse.json({ data }) : notFound();
  } catch (err) {
    return serverError(err);
  }
}
