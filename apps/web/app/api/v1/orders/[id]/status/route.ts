import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import {
  canTransition,
  nextStatuses,
  stockEffectOfCancel,
  validateTransition,
  requiresReason,
  getOrderPickupPin,
} from "../../../_lib/order-machine";
import { afterResponse } from "../../../_lib/email/after";
import { notifyOrderStatus } from "../../../_lib/email/events";
import { adjustAll, type InventoryChange } from "../../../pos/_lib/inventory";
import { transitionOrderStatus } from "../../../pos/_lib/order-status";
import { readJson, serverError } from "../../../_lib/http";

import { validateCourierFields } from "../../../_lib/order-admin";

const KNOWN = ["placed", "confirmed", "ready_for_pickup", "collected", "cancelled", "expired", "on_hold", "paid", "processing", "shipped", "delivered"];

/**
 * Moves a pickup order to its next status according to the pickup fulfillment flow:
 *   placed -> confirmed -> ready_for_pickup -> collected
 *
 * Enforces business rules:
 *   1. Cannot move to collected unless payment_status is 'paid'.
 *   2. Forward transitions follow the map.
 *   3. Moving backward or off-track requires a reason.
 *   4. Cancellation is allowed from any state before collected, and requires a reason.
 *   5. Permission-gated: cancel requires can_cancel_orders; status updates require can_update_order_status.
 */
export const PUT = withIdempotency(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requirePermission(request, "can_view_all_orders");
    if (!access.ok) return access.response;

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = (parsed.body ?? {}) as Record<string, unknown>;

    const to = body.status;
    if (typeof to !== "string" || !KNOWN.includes(to)) {
      return NextResponse.json(
        { error: `Status must be one of: ${KNOWN.join(", ")}.`, code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    if (to === "paid") {
      return NextResponse.json(
        { error: "Use the payment route to mark orders as paid.", code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    const courier = validateCourierFields(body);
    if (!courier.ok) {
      return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: courier.errors }, { status: 400 });
    }

    const reason = typeof body.reason === "string" ? body.reason.trim() : (body.reason === "" ? "" : undefined);

    // Check action-specific permission for non-admins
    if (!access.isAdmin) {
      const requiredPerm = to === "cancelled" ? "can_cancel_orders" : "can_update_order_status";
      if (!access.permissions[requiredPerm]) {
        return NextResponse.json({ error: "Permission denied.", code: "PERMISSION_DENIED" }, { status: 403 });
      }
    }

    const client = createServiceClient();
    const { data, error } = await client
      .from("orders")
      .select("id, order_number, channel, status, payment_status, items:order_items(variant_id, quantity)")
      .eq("id", id)
      .maybeSingle();

    if (error) return serverError(new Error(error.message));
    if (!data) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

    const order = data as {
      id: string;
      order_number: string;
      channel: string;
      status: string;
      payment_status: string;
      items: Array<{ variant_id: string | null; quantity: number }> | null;
    };

    if (order.channel === "walk_in") {
      return NextResponse.json(
        { error: "Walk-in sales can't be moved here. Use the till to void one.", code: "INVALID_CHANNEL" },
        { status: 409 }
      );
    }

    const validation = validateTransition(order.status, to, order.payment_status || "unpaid", reason);
    if (!validation.ok) {
      const status = validation.code === "INVALID_TRANSITION" ? 409 : 400;
      return NextResponse.json(
        {
          error: validation.reason,
          code: validation.code,
          details: { current: order.status, allowed: nextStatuses(order.status) },
        },
        { status }
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: to,
      updated_at: now,
      ...courier.value,
    };

    if (to === "shipped") {
      patch.shipped_at = now;
    }
    if (to === "delivered") {
      patch.delivered_at = now;
    }
    if (to === "ready_for_pickup") {
      patch.ready_for_pickup_at = now;
      const { data: settings } = await client
        .from("settings")
        .select("pickup_hold_hours")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();
      const holdHours =
        settings?.pickup_hold_hours && settings.pickup_hold_hours > 0 ? settings.pickup_hold_hours : 48;
      patch.pickup_deadline = new Date(Date.now() + holdHours * 3_600_000).toISOString();
      const pickupPin = getOrderPickupPin(order);
      patch.tracking_number = pickupPin;
    }
    if (to === "collected") {
      patch.delivered_at = now;
    }
    if (to === "cancelled") {
      patch.cancel_reason = reason;
      patch.cancelled_by = access.user.id;
    }
    if (to === "on_hold") {
      patch.hold_reason = reason;
    }

    const claimed = await transitionOrderStatus(client, id, order.status, patch);
    if (!claimed) {
      return NextResponse.json(
        { error: "Someone else just changed this order. Reload it and try again.", code: "ORDER_CHANGED" },
        { status: 409 }
      );
    }

    let refundRequired = false;
    if (to === "cancelled" || to === "expired") {
      const lines = (order.items ?? []).filter((i) => i.variant_id);
      const effect = stockEffectOfCancel(order.payment_status || order.status);
      const changes: InventoryChange[] = lines.map((i) =>
        effect === "release"
          ? { variantId: i.variant_id as string, deltaReserved: -i.quantity, clampReserved: true }
          : { variantId: i.variant_id as string, deltaQuantity: i.quantity }
      );

      if (changes.length > 0) {
        const stock = await adjustAll(client, changes);
        if (!stock.ok) {
          // Rollback order status to agree with stock
          await transitionOrderStatus(client, id, to, { status: order.status });
          return NextResponse.json(
            { error: "Couldn't update stock, so the order was left as it was. Please try again.", code: "STOCK_UPDATE_FAILED" },
            { status: 503 }
          );
        }
        if (effect === "restock") {
          await client.from("stock_movements").insert(
            lines.map((i) => ({
              variant_id: i.variant_id,
              delta: i.quantity,
              reason: "return",
              order_id: id,
              actor_id: access.user.id,
              notes: `Order ${order.order_number} ${to}`,
            }))
          );
        }
      }
      refundRequired = order.payment_status === "paid" || order.status === "paid";
    }

    // Append-only audit log
    await logActivity(client, {
      actorId: access.user.id,
      action: "order.status",
      targetType: "order",
      targetId: id,
      changes: {
        from: order.status,
        to,
        reason: reason ?? null,
        payment_status: order.payment_status,
      },
      ip: clientIp(request),
    });

    afterResponse(() => (reason ? notifyOrderStatus(client, id, to, reason) : notifyOrderStatus(client, id, to)));

    const { data: fresh } = await client
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, ready_for_pickup_at, delivered_at, cancel_reason, hold_reason, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({
      data: {
        ...(fresh ?? { id, order_number: order.order_number, status: to, payment_status: order.payment_status }),
        refund_required: refundRequired,
      },
      notification: {
        type: "order_advance",
        orderNumber: order.order_number,
        orderStatus: to,
        title: `Order #${order.order_number} ${to.toUpperCase()}`,
        message: `Order #${order.order_number} is now ${to.replace(/_/g, " ")}.`,
        link: `/track?order_number=${order.order_number}`,
        createdAt: now,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
