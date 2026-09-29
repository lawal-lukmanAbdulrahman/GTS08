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

/** One order in full with audit log history, for staff who can see all orders. */
export async function GET(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_view_all_orders");
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from("orders")
      .select(
        `id, order_number, channel, status, payment_status, payment_method, paid_confirmed_by,
         cancel_reason, cancelled_by, hold_reason, ready_for_pickup_at, pickup_deadline,
         subtotal, delivery_fee, discount_amount, total, promo_code,
         internal_notes, paid_at, delivered_at, created_at, updated_at,
         customer:customers(id, full_name, email, phone),
         address:addresses(full_name, phone, address_line1, address_line2, city, state),
         items:order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot),
         payments:transactions(payment_method, payment_status, amount, paystack_channel, created_at),
         pickup_station:pickup_stations(id, name, address_line1, address_line2, city, state, phone, operating_hours, notes)`
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return serverError(new Error(error.message));
    if (!data) return notFound();
    const order = data as { status: string; channel: string };

    // Fetch append-only audit trail
    const { data: logs } = await serviceClient
      .from("activity_logs")
      .select("id, actor_id, action, changes, ip_address, created_at, actor:users!activity_logs_actor_id_fkey(full_name, email)")
      .eq("target_type", "order")
      .eq("target_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      data: {
        ...order,
        order_status: order.status,
        allowed_next: order.channel === "walk_in" ? [] : nextStatuses(order.status),
        audit_log: logs || [],
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

/** Internal notes update. Status and payment updates have their own dedicated routes. */
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
      .select("id, order_number, status, payment_status, carrier_name, tracking_number, carrier_tracking_url, internal_notes, updated_at")
      .maybeSingle();

    if (error) return serverError(new Error(error.message));
    if (!data) return notFound();

    await logActivity(client, {
      actorId: access.user.id,
      action: "order.update",
      targetType: "order",
      targetId: id,
      changes: { fields: Object.keys(check.value) },
      ip: clientIp(request),
    });

    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}
