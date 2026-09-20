import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../../_lib/staff-access";
import { serverError } from "../../../_lib/http";

// PATCH /api/v1/inquiries/[id]/status
// Restricted to staff/admin, wrapped in idempotency
export const PATCH = withIdempotency(async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requirePermission(request, "can_handle_tickets");
    if (!access.ok) return access.response;
    const authUser = access.user;
    const serviceClient = createServiceClient();

    const { id: ticketId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["open", "in_progress", "resolved", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value", code: "BAD_REQUEST" }, { status: 400 });
    }

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    } else if (status === "closed") {
      updates.closed_at = new Date().toISOString();
    }

    const { data, error } = await serviceClient
      .from("support_tickets")
      .update(updates)
      .eq("id", ticketId)
      .select("id, status, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, code: "UPDATE_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return serverError(err);
  }
});
