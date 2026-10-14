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
      { error: "A reason is required to disable this customer account.", code: "REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  try {
    const now = new Date().toISOString();

    // 1. Fetch store support phone from settings
    const { data: storeSettings } = await serviceClient
      .from("settings")
      .select("support_phone, store_name")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    const supportPhone = storeSettings?.support_phone || "+234 800 000 0000";

    // 2. Locate user and customer records
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

    // 3. Update users table if user exists
    if (userId) {
      await serviceClient
        .from("users")
        .update({
          is_disabled: true,
          disabled_reason: reason,
          disabled_at: now,
        })
        .eq("id", userId);
    }

    // 4. Update customers table
    if (cId) {
      await serviceClient
        .from("customers")
        .update({
          is_disabled: true,
          disabled_reason: reason,
          disabled_at: now,
        })
        .eq("id", cId);
    }

    // 5. Insert notification into customer_notifications
    const customerName = customerRow?.full_name || userRow?.full_name || "Valued Customer";
    const notifMessage = [
      `Dear ${customerName},`,
      ``,
      `We are writing to formally notify you that administrative restrictions have been placed on your GTS customer account.`,
      ``,
      `Official Reason for Restriction:`,
      `"${reason}"`,
      ``,
      `What this means for your account:`,
      `• Placing new orders and submitting live inquiries are temporarily restricted.`,
      `• You can continue to browse our full product catalog and save items to your wishlist.`,
      `• Your past order records, delivery addresses, and preferences remain safe and preserved.`,
      ``,
      `How to Re-enable Your Account:`,
      `If you believe this action was taken in error, or if you would like to discuss resolving this matter to re-enable your account privileges, please contact our Customer Support Operations directly at ${supportPhone}. Our representatives will review your account promptly.`,
      ``,
      `Thank you for your cooperation and understanding.`,
      ``,
      `Sincerely,`,
      `GTS Customer Operations & Security Team`,
    ].join("\n");

    await serviceClient.from("customer_notifications").insert({
      user_id: userId,
      customer_id: cId,
      type: "account_disabled",
      title: "Account Access Temporarily Restricted",
      message: notifMessage,
      metadata: {
        reason,
        supportPhone,
        status: "disabled",
        image: "https://res.cloudinary.com/drstfd8gs/image/upload/f_auto,q_auto/v1791960379/gts/notifications/red-account-disabled.jpg",
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: customerId,
        isDisabled: true,
        disabledReason: reason,
        disabledAt: now,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
