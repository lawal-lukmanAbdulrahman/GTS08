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
  const serviceClient = createServiceClient();

  try {
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

    // 2. Re-enable in users table
    if (userId) {
      await serviceClient
        .from("users")
        .update({
          is_disabled: false,
          disabled_reason: null,
          disabled_at: null,
        })
        .eq("id", userId);
    }

    // 3. Re-enable in customers table
    if (cId) {
      await serviceClient
        .from("customers")
        .update({
          is_disabled: false,
          disabled_reason: null,
          disabled_at: null,
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

    const customerName = customerRow?.full_name || userRow?.full_name || "Valued Customer";

    const notifMessage = [
      `Dear ${customerName},`,
      ``,
      `We are pleased to inform you that following an administrative review, your GTS account privileges have been officially re-enabled and full account access has been restored.`,
      ``,
      `What has been restored on your account:`,
      `• Catalog & Tiered Pricing: Full access to explore all product categories and take advantage of bulk wholesale pricing discounts.`,
      `• Seamless Checkout & Fulfillment: Ability to place new orders with your preferred delivery or in-store collection methods.`,
      `• Support & Inquiry Desk: Direct communication with our customer service team and real-time order tracking.`,
      `• Preserved Account Data: All your previous order history, shipping addresses, and saved wishlist items remain safe and accessible.`,
      ``,
      `Customer Assistance & Inquiries:`,
      `If you have any questions or require support regarding your account or upcoming orders, please reach out to our Customer Operations Team:`,
      `• Customer Support Hotline: ${supportPhone}`,
      `• Operating Hours: Monday to Saturday, 8:00 AM – 6:00 PM (WAT)`,
      ``,
      `We sincerely thank you for your patience and for being a valued part of the GTS family. Happy shopping!`,
      ``,
      `Warm regards,`,
      `GTS Customer Operations & Support Desk`,
    ].join("\n");

    // 5. Send customer notification
    await serviceClient.from("customer_notifications").insert({
      user_id: userId,
      customer_id: cId,
      type: "account_enabled",
      title: "Account Access Restored — Welcome Back!",
      message: notifMessage,
      metadata: {
        supportPhone,
        status: "active",
        image: "https://res.cloudinary.com/drstfd8gs/image/upload/f_auto,q_auto/v1791960377/gts/notifications/green-account-enabled.jpg",
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: customerId,
        isDisabled: false,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
