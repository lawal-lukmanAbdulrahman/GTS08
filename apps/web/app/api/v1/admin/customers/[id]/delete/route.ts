import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../../../_lib/staff-access";
import { serverError } from "../../../../_lib/http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  const { id: customerId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reason = (body.reason || "").trim();

  if (!reason) {
    return NextResponse.json(
      { error: "A reason is required to delete this customer account.", code: "REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  try {
    const now = new Date().toISOString();

    // 1. Locate user and customer records
    const { data: userRow } = await serviceClient
      .from("users")
      .select("id, email, full_name")
      .eq("id", customerId)
      .maybeSingle();

    const { data: customerRow } = await serviceClient
      .from("customers")
      .select("id, user_id, email, full_name")
      .or(`id.eq.${customerId},user_id.eq.${customerId}`)
      .limit(1)
      .maybeSingle();

    const userId = userRow?.id || customerRow?.user_id || null;
    const cId = customerRow?.id || null;

    if (!userRow && !customerRow) {
      return NextResponse.json({ error: "Customer not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // 2. Soft-delete in users table (redeemable for 30 days)
    if (userId) {
      await serviceClient
        .from("users")
        .update({
          deleted_at: now,
          deletion_reason: reason,
          deletion_notified: false,
        })
        .eq("id", userId);
    }

    // 3. Soft-delete in customers table
    if (cId) {
      await serviceClient
        .from("customers")
        .update({
          deleted_at: now,
          deletion_reason: reason,
          deletion_notified: false,
        })
        .eq("id", cId);
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: customerId,
        deletedAt: now,
        deletionReason: reason,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
