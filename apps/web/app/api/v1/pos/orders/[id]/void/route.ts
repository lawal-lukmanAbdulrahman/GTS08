import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { startOfWATDay, isUuid } from "@gts/utils";
import { requirePosPermission } from "../../../_lib/access";
import { clientIp, logActivity } from "../../../../_lib/activity";
import { adjustAll, type InventoryChange } from "../../../_lib/inventory";
import { transitionOrderStatus } from "../../../_lib/order-status";
import { sanitizeSqlInput } from "../../../../auth/utils";

function isToday(isoDate: string): boolean {
  return new Date(isoDate).getTime() >= startOfWATDay(new Date()).getTime();
}

/**
 * gts_03_cashier_spec.md Part 6: cashier can void a same-day completed order,
 * which restores inventory and logs the reversal.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requirePosPermission(request, "can_void_orders");
  if (!access.ok) return access.response;

  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Order not found.", code: "ORDER_NOT_FOUND" }, { status: 404 });

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = body.reason ? sanitizeSqlInput(body.reason) : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A void reason is required.", code: "REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .select("id, status, created_at, cashier_id, items:order_items(variant_id, quantity)")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found.", code: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const found = order as unknown as {
    id: string;
    status: string;
    created_at: string;
    cashier_id: string | null;
    items: Array<{ variant_id: string | null; quantity: number }>;
  };

  // A sale belongs to whoever took the payment (for a WhatsApp order that can
  // differ from who recorded it). Cashiers void only their own; admins any.
  if (!access.isAdmin) {
    const { data: payment } = await serviceClient
      .from("transactions")
      .select("confirmed_by")
      .eq("order_id", id)
      .eq("payment_status", "success")
      .limit(1)
      .maybeSingle();
    const owner = (payment as { confirmed_by: string | null } | null)?.confirmed_by ?? found.cashier_id;
    if (owner !== access.user.id) {
      return NextResponse.json(
        { error: "You can only void sales you took payment for.", code: "NOT_YOUR_SALE" },
        { status: 403 }
      );
    }
  }

  if (!isToday(found.created_at)) {
    return NextResponse.json(
      { error: "Only same-day orders can be voided.", code: "NOT_TODAYS_ORDER" },
      { status: 409 }
    );
  }

  if (found.status === "voided") {
    return NextResponse.json(
      { error: "This order has already been voided.", code: "ALREADY_VOIDED" },
      { status: 409 }
    );
  }
  if (found.status !== "completed") {
    return NextResponse.json(
      { error: `Only completed orders can be voided (this one is '${found.status}').`, code: "NOT_VOIDABLE" },
      { status: 409 }
    );
  }

  const claimed = await transitionOrderStatus(serviceClient, id, "completed", {
    status: "voided",
    internal_notes: reason,
  });
  if (!claimed) {
    return NextResponse.json(
      { error: "This order was just changed by someone else.", code: "ORDER_NOT_COMPLETED" },
      { status: 409 }
    );
  }

  const restock: InventoryChange[] = found.items
    .filter((item) => item.variant_id)
    .map((item) => ({ variantId: item.variant_id as string, deltaQuantity: item.quantity }));
  await adjustAll(serviceClient, restock);

  await serviceClient.from("stock_movements").insert(
    restock.map((c) => ({
      variant_id: c.variantId,
      delta: c.deltaQuantity,
      reason: "void",
      order_id: id,
      actor_id: access.user.id,
      notes: reason,
    }))
  );

  await logActivity(serviceClient, {
    actorId: access.user.id,
    action: "pos.void",
    targetType: "order",
    targetId: id,
    changes: { reason },
    ip: clientIp(request),
  });

  return NextResponse.json({ data: { id, status: "voided" } });
}
