import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid, getOrderPickupPin } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import { afterResponse } from "../../../_lib/email/after";
import { notifyOrderStatus } from "../../../_lib/email/events";
import { readJson, serverError } from "../../../_lib/http";

const VALID_METHODS = ["cash", "transfer", "pos", "card"];

/**
 * Handover flow: sets the order to 'paid' and 'collected' in ONE atomic operation.
 * If already paid, it just marks collected.
 *
 * Anti-theft rule:
 * For online storefront and WhatsApp orders, the customer must present their
 * secret 6-digit collection PIN (or QR code) which staff must verify before completing handover.
 * Walk-in till sales (channel === 'pos' or 'walk_in') do not require PIN as they are paid and printed at the till.
 *
 * Gated by `can_complete_pickup`.
 * If payment is required (unpaid order), caller also needs `can_mark_orders_paid` (or admin).
 */
export const POST = withIdempotency(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pickupAccess = await requirePermission(request, "can_complete_pickup");
  if (!pickupAccess.ok) return pickupAccess.response;

  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

    const parsed = await readJson(request);
    const body = (parsed.ok ? parsed.body : {}) as Record<string, unknown>;

    const client = createServiceClient();
    const { data: order, error: fetchErr } = await client
      .from("orders")
      .select("id, order_number, channel, status, payment_status, payment_method, total, tracking_number")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(new Error(fetchErr.message));
    if (!order) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

    if (order.status === "collected") {
      return NextResponse.json(
        { error: "Order has already been collected.", code: "ALREADY_COLLECTED" },
        { status: 400 }
      );
    }

    if (order.status === "cancelled" || order.status === "expired") {
      return NextResponse.json(
        { error: `Cannot complete pickup for an order that is ${order.status}.`, code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    // ── Anti-theft: 6-digit PIN verification for Storefront & WhatsApp orders ──
    const isWalkIn = order.channel === "pos" || order.channel === "walk_in";
    if (!isWalkIn) {
      const enteredPin = typeof body.pickup_pin === "string" ? body.pickup_pin.trim().replace(/\s+/g, "") : "";
      const expectedPin = getOrderPickupPin(order);
      if (!enteredPin || enteredPin !== expectedPin) {
        return NextResponse.json(
          {
            error: "Invalid 6-digit collection PIN. Please request the customer's PIN shown on their tracking page or email.",
            code: "INVALID_PICKUP_PIN",
          },
          { status: 400 }
        );
      }
    }

    const isCurrentlyPaid = order.payment_status === "paid";
    let paymentMethodToRecord: string | null = null;

    if (!isCurrentlyPaid) {
      // Must have payment permission to accept payment at counter
      if (!pickupAccess.isAdmin && !pickupAccess.permissions.can_mark_orders_paid) {
        return NextResponse.json(
          { error: "You need permission to mark orders as paid to collect payment.", code: "PERMISSION_DENIED" },
          { status: 403 }
        );
      }

      const method = typeof body.payment_method === "string" ? body.payment_method.toLowerCase().trim() : "";
      if (!VALID_METHODS.includes(method)) {
        return NextResponse.json(
          { error: `Select a payment method (${VALID_METHODS.join(", ")}) to complete pickup.`, code: "PAYMENT_METHOD_REQUIRED" },
          { status: 400 }
        );
      }
      paymentMethodToRecord = method;
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: "collected",
      delivered_at: now,
      updated_at: now,
    };

    if (!isCurrentlyPaid) {
      patch.payment_status = "paid";
      patch.payment_method = paymentMethodToRecord;
      patch.paid_confirmed_by = pickupAccess.user.id;
      patch.paid_at = now;
    }

    const { data: updated, error: updateErr } = await client
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("id, order_number, status, payment_status, payment_method, paid_at, delivered_at, updated_at")
      .maybeSingle();

    if (updateErr) return serverError(new Error(updateErr.message));

    // Audit log
    await logActivity(client, {
      actorId: pickupAccess.user.id,
      action: "order.status",
      targetType: "order",
      targetId: id,
      changes: {
        action: "complete_pickup",
        from: order.status,
        to: "collected",
        payment_status: { from: order.payment_status, to: "paid" },
        payment_method: paymentMethodToRecord || order.payment_method,
      },
      ip: clientIp(request),
    });

    afterResponse(() => notifyOrderStatus(client, id, "collected"));

    return NextResponse.json({
      ok: true,
      data: updated,
      message: "Order pickup completed successfully.",
    });
  } catch (err) {
    return serverError(err);
  }
});
