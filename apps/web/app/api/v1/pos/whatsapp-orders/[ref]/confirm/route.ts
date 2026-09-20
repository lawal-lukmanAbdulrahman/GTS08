import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePosAccess } from "../../../_lib/access";
import { adjustAll, type InventoryChange } from "../../../_lib/inventory";
import { transitionOrderStatus } from "../../../_lib/order-status";
import { clientIp, logActivity } from "../../../../_lib/activity";

const PAYMENT_METHODS = ["cash", "pos_terminal"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * D001: cashier confirms a WhatsApp order looked up by number, taking
 * payment and completing it the same way a walk-in sale completes
 * (gts_03_cashier_spec.md Part 5.2) — except stock was already reserved at
 * creation, so this releases the reservation instead of a fresh decrement.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { ref: id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Order not found.", code: "ORDER_NOT_FOUND" }, { status: 404 });

  let body: { payment_method?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  if (!PAYMENT_METHODS.includes(body.payment_method as PaymentMethod)) {
    return NextResponse.json(
      { error: "Payment method must be 'cash' or 'pos_terminal'.", code: "INVALID_PAYMENT_METHOD" },
      { status: 400 }
    );
  }
  const paymentMethod = body.payment_method as PaymentMethod;

  const serviceClient = createServiceClient();

  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .select("id, status, total, order_number, items:order_items(variant_id, quantity, unit_price)")
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
    total: number;
    order_number: string;
    items: Array<{ variant_id: string | null; quantity: number; unit_price: number }>;
  };

  if (found.status !== "pending_payment") {
    return NextResponse.json(
      { error: `This order is already '${found.status}'.`, code: "ORDER_NOT_PENDING" },
      { status: 409 }
    );
  }

  // Claim the order first: if a cancel (or another confirm) got there first
  // this returns false and no stock is touched.
  const claimed = await transitionOrderStatus(serviceClient, id, "pending_payment", {
    status: "completed",
    paid_at: new Date().toISOString(),
  });
  if (!claimed) {
    return NextResponse.json(
      { error: "This order was just changed by someone else.", code: "ORDER_NOT_PENDING" },
      { status: 409 }
    );
  }

  const stockChanges: InventoryChange[] = found.items
    .filter((item) => item.variant_id)
    .map((item) => ({
      variantId: item.variant_id as string,
      deltaQuantity: -item.quantity,
      deltaReserved: -item.quantity,
    }));
  const stockResult = await adjustAll(serviceClient, stockChanges);
  if (!stockResult.ok) {
    await transitionOrderStatus(serviceClient, id, "completed", { status: "pending_payment", paid_at: null });
    return NextResponse.json(
      { error: "Could not update stock for this order. Nothing was charged; try again.", code: "STOCK_UPDATE_FAILED" },
      { status: 503 }
    );
  }

  await serviceClient.from("transactions").insert({
    order_id: id,
    payment_method: paymentMethod,
    payment_status: "success",
    amount: found.total,
    confirmed_by: access.user.id,
  });

  await serviceClient.from("stock_movements").insert(
    stockChanges.map((c) => ({
      variant_id: c.variantId,
      delta: c.deltaQuantity,
      reason: "sale_pos",
      order_id: id,
      actor_id: access.user.id,
    }))
  );

  await logActivity(serviceClient, {
    actorId: access.user.id,
    action: "pos.whatsapp_confirm",
    targetType: "order",
    targetId: id,
    changes: { order_number: found.order_number, total: found.total, payment_method: paymentMethod },
    ip: clientIp(request),
  });

  return NextResponse.json({
    data: {
      order_id: found.id,
      order_number: found.order_number,
      status: "completed",
      total: found.total,
      payment_method: paymentMethod,
    },
  });
}
