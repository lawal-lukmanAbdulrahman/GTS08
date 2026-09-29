import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import { readJson, serverError } from "../../../_lib/http";

const VALID_METHODS = ["cash", "transfer", "pos", "card"];

/**
 * Marks an order as paid independently of order status.
 * Requires the `can_mark_orders_paid` permission (or admin).
 */
export const POST = withIdempotency(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePermission(request, "can_mark_orders_paid");
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = (parsed.body ?? {}) as Record<string, unknown>;

    const paymentMethod = typeof body.payment_method === "string" ? body.payment_method.toLowerCase().trim() : "";
    if (!VALID_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${VALID_METHODS.join(", ")}.`, code: "INVALID_PAYMENT_METHOD" },
        { status: 400 }
      );
    }

    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    const client = createServiceClient();
    const { data: order, error: fetchErr } = await client
      .from("orders")
      .select("id, order_number, status, payment_status, total")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(new Error(fetchErr.message));
    if (!order) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });

    if (order.payment_status === "paid") {
      return NextResponse.json({
        ok: true,
        data: order,
        message: "Order is already marked as paid.",
      });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await client
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: paymentMethod,
        paid_confirmed_by: access.user.id,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .select("id, order_number, status, payment_status, payment_method, paid_at, updated_at")
      .maybeSingle();

    if (updateErr) return serverError(new Error(updateErr.message));

    // Record transaction so cash in register and bank figures reflect the payment
    await client.from("transactions").insert({
      order_id: id,
      payment_method: paymentMethod,
      payment_status: "success",
      amount: order.total,
      confirmed_by: access.user.id,
    });

    // Audit log
    await logActivity(client, {
      actorId: access.user.id,
      action: "order.status",
      targetType: "order",
      targetId: id,
      changes: {
        payment_status: { from: order.payment_status, to: "paid" },
        payment_method: paymentMethod,
        reason,
      },
      ip: clientIp(request),
    });

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (err) {
    return serverError(err);
  }
});
