import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import { canTransition, nextStatuses, stockEffectOfCancel } from "../../../_lib/order-machine";
import { validateCourierFields } from "../../../_lib/order-admin";
import { afterResponse } from "../../../_lib/email/after";
import { notifyOrderStatus } from "../../../_lib/email/events";
import { adjustAll, type InventoryChange } from "../../../pos/_lib/inventory";
import { transitionOrderStatus } from "../../../pos/_lib/order-status";
import { readJson, serverError } from "../../../_lib/http";

const KNOWN = ["confirmed", "processing", "shipped", "delivered", "cancelled"];

/**
 * Moves an online or WhatsApp order to its next status. The move is claimed
 * with a compare-and-swap, so two admins can't both apply it; cancelling puts
 * the order's stock back (or frees the hold, if it was never paid).
 */
export const PUT = withIdempotency(async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermission(request, "can_view_all_orders");
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = (parsed.body ?? {}) as Record<string, unknown>;

    const to = body.status;
    if (typeof to !== "string" || !KNOWN.includes(to)) {
      return NextResponse.json({ error: `Status must be one of: ${KNOWN.join(", ")}.`, code: "INVALID_STATUS" }, { status: 400 });
    }
    const courier = validateCourierFields(body);
    if (!courier.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: courier.errors }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client
      .from("orders")
      .select("id, order_number, channel, status, items:order_items(variant_id, quantity)")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });
    const order = data as { id: string; order_number: string; channel: string; status: string; items: Array<{ variant_id: string | null; quantity: number }> | null };

    if (order.channel === "walk_in" || !canTransition(order.status, to)) {
      return NextResponse.json(
        {
          error: order.channel === "walk_in" ? "Walk-in sales can't be moved here. Use the till to void one." : `An order that is ${order.status.replace("_", " ")} can't be moved to ${to}.`,
          code: "INVALID_TRANSITION",
          details: { current: order.status, allowed: order.channel === "walk_in" ? [] : nextStatuses(order.status) },
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: to, ...courier.value };
    if (to === "shipped") patch.shipped_at = now;
    if (to === "delivered") patch.delivered_at = now;

    const claimed = await transitionOrderStatus(client, id, order.status, patch);
    if (!claimed) return NextResponse.json({ error: "Someone else just changed this order. Reload it and try again.", code: "ORDER_CHANGED" }, { status: 409 });

    let refundRequired = false;
    if (to === "cancelled") {
      const lines = (order.items ?? []).filter((i) => i.variant_id);
      const effect = stockEffectOfCancel(order.status);
      const changes: InventoryChange[] = lines.map((i) =>
        effect === "release" ? { variantId: i.variant_id as string, deltaReserved: -i.quantity, clampReserved: true } : { variantId: i.variant_id as string, deltaQuantity: i.quantity }
      );
      if (changes.length > 0) {
        const stock = await adjustAll(client, changes);
        if (!stock.ok) {
          // Put the order back so its status and its stock still agree, and let the admin retry.
          await transitionOrderStatus(client, id, "cancelled", { status: order.status });
          return NextResponse.json({ error: "Couldn't update stock, so the order was left as it was. Please try again.", code: "STOCK_UPDATE_FAILED" }, { status: 503 });
        }
        if (effect === "restock") {
          await client.from("stock_movements").insert(
            lines.map((i) => ({ variant_id: i.variant_id, delta: i.quantity, reason: "return", order_id: id, actor_id: access.user.id, notes: `Order ${order.order_number} cancelled` }))
          );
        }
      }
      refundRequired = order.status !== "pending_payment";
    }

    await logActivity(client, { actorId: access.user.id, action: "order.status", targetType: "order", targetId: id, changes: { from: order.status, to }, ip: clientIp(request) });
    afterResponse(() => notifyOrderStatus(client, id, to));

    const { data: fresh } = await client.from("orders").select("id, order_number, status, carrier_name, tracking_number, carrier_tracking_url, shipped_at, delivered_at, updated_at").eq("id", id).maybeSingle();
    return NextResponse.json({
      data: { ...(fresh ?? { id, order_number: order.order_number, status: to }), refund_required: refundRequired },
      notification: {
        type: "order_advance",
        orderNumber: order.order_number,
        orderStatus: to,
        title: `Order #${order.order_number} ${to.toUpperCase()}`,
        message: `Your order has advanced to ${to}. Tap to track your package live.`,
        link: `/track?order_number=${order.order_number}`,
        createdAt: now,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
