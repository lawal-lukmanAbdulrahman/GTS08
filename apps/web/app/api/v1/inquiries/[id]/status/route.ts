import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../../auth/utils";
import { withIdempotency } from "@/lib/idempotency";

// PATCH /api/v1/inquiries/[id]/status
// Restricted to staff/admin, wrapped in idempotency
export const PATCH = withIdempotency(async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: userProfile } = await serviceClient
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (!userProfile || !["admin", "inventory_staff"].includes(userProfile.role)) {
      return NextResponse.json({ error: "Forbidden: Staff credentials required", code: "FORBIDDEN" }, { status: 403 });
    }

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
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});
