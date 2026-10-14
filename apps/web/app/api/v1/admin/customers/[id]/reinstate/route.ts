import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../../../_lib/staff-access";
import { notifyCustomerReinstated } from "../../../../_lib/email/events";
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
      { error: "A reason is required before the account is reinstated.", code: "REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  try {
    const now = new Date().toISOString();

    // 1. Locate user and customer records
    const { data: userRow } = await serviceClient
      .from("users")
      .select("id, email, full_name, deleted_at")
      .eq("id", customerId)
      .maybeSingle();

    const { data: customerRow } = await serviceClient
      .from("customers")
      .select("id, user_id, email, full_name, deleted_at")
      .or(`id.eq.${customerId},user_id.eq.${customerId}`)
      .limit(1)
      .maybeSingle();

    const userId = userRow?.id || customerRow?.user_id || null;
    const cId = customerRow?.id || null;
    const email = userRow?.email || customerRow?.email || "";
    const name = userRow?.full_name || customerRow?.full_name || "Valued Customer";

    if (!userRow && !customerRow) {
      return NextResponse.json({ error: "Customer not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // 2. Reinstate in users table
    if (userId) {
      await serviceClient
        .from("users")
        .update({
          deleted_at: null,
          deletion_reason: null,
          is_disabled: false,
          disabled_reason: null,
          disabled_at: null,
          reinstated_at: now,
          reinstatement_reason: reason,
          deletion_notified: false,
        })
        .eq("id", userId);
    }

    // 3. Reinstate in customers table
    if (cId) {
      await serviceClient
        .from("customers")
        .update({
          deleted_at: null,
          deletion_reason: null,
          is_disabled: false,
          disabled_reason: null,
          disabled_at: null,
          reinstated_at: now,
          reinstatement_reason: reason,
          deletion_notified: false,
        })
        .eq("id", cId);
    }

    // 4. Fetch store support phone from settings
    const { data: storeSettings } = await serviceClient
      .from("settings")
      .select("support_phone, store_name")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    const supportPhone = storeSettings?.support_phone || "+234 800 000 0000";

    const notifMessage = [
      `Dear ${name},`,
      ``,
      `We are pleased to inform you that following an administrative review, your previously deleted GTS customer account has been officially reinstated and removed from the pending deletion registry.`,
      ``,
      `Administrative Resolution Note:`,
      `"${reason}"`,
      ``,
      `Your Account Access & Privileges Have Been Fully Restored:`,
      `• Complete Account Restoration: Your account is now fully operational and in good standing with all access restored.`,
      `• Seamless Shopping & Orders: You can sign in, browse our full catalog, utilize tiered pricing discounts, and complete checkout.`,
      `• Dedicated Support & Tracking: Direct access to live inquiries, discussion threads, and real-time order fulfillment updates.`,
      `• Preserved Account Records: Your previous order history, delivery addresses, and saved wishlist favorites have been completely recovered.`,
      ``,
      `Customer Assistance & Inquiries:`,
      `If you have any questions or require assistance regarding your account reinstatement, our dedicated support team is available to help:`,
      `• Customer Support Hotline: ${supportPhone}`,
      `• Operating Hours: Monday to Saturday, 8:00 AM – 6:00 PM (WAT)`,
      ``,
      `We are thrilled to welcome you back to GTS!`,
      ``,
      `Warm regards,`,
      `GTS Executive Customer Operations`,
    ].join("\n");

    // 5. Send customer notification to inbox
    await serviceClient.from("customer_notifications").insert({
      user_id: userId,
      customer_id: cId,
      type: "account_reinstated",
      title: "Account Successfully Reinstated — Welcome Back!",
      message: notifMessage,
      metadata: {
        reason,
        supportPhone,
        status: "reinstated",
        image: "https://res.cloudinary.com/drstfd8gs/image/upload/f_auto,q_auto/v1791960377/gts/notifications/green-account-enabled.jpg",
      },
    });

    // 5. Send reinstatement email to customer
    if (email) {
      await notifyCustomerReinstated(serviceClient as any, {
        email,
        name,
        reason,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: customerId,
        isReinstated: true,
        reinstatedAt: now,
        reinstatementReason: reason,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
