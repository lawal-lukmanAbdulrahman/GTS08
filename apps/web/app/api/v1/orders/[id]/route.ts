import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { nextStatuses } from "../../_lib/order-machine";
import { validateCourierFields } from "../../_lib/order-admin";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

/** One order in full, for staff who can see all orders. */
export async function GET(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_view_all_orders");
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const { data, error } = await createServiceClient()
      .from("orders")
      .select(
        `id, order_number, channel, status, subtotal, delivery_fee, discount_amount, total, promo_code,
         carrier_name, tracking_number, carrier_tracking_url, internal_notes, paid_at, shipped_at, delivered_at, created_at, updated_at,
         customer:customers(id, full_name, email, phone),
         address:addresses(full_name, phone, address_line1, address_line2, city, state),
         items:order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot),
         payments:transactions(payment_method, payment_status, amount, paystack_channel, created_at)`
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return notFound();
    const order = data as { status: string; channel: string };
    return NextResponse.json({ data: { ...order, allowed_next: order.channel === "walk_in" ? [] : nextStatuses(order.status) } });
  } catch (err) {
    return serverError(err);
  }
}

/** Notes and courier details. The status has its own route, because it has rules. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_view_all_orders");
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validateCourierFields(parsed.body);
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });
    if (Object.keys(check.value).length === 0) return NextResponse.json({ error: "Nothing to update.", code: "NOTHING_TO_UPDATE" }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client
      .from("orders")
      .update({ ...check.value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, order_number, status, carrier_name, tracking_number, carrier_tracking_url, internal_notes")
      .maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return notFound();

    await logActivity(client, { actorId: access.user.id, action: "order.update", targetType: "order", targetId: id, changes: { fields: Object.keys(check.value) }, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}
