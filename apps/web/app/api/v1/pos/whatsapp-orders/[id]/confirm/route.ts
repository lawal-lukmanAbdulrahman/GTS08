import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../../_lib/access";

const PAYMENT_METHODS = ["cash", "pos_terminal"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * D001: cashier confirms a WhatsApp order looked up by number, taking
 * payment and completing it the same way a walk-in sale completes
 * (gts_03_cashier_spec.md Part 5.2) — except stock was already reserved at
 * creation, so this releases the reservation instead of a fresh decrement.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;

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

  await serviceClient
    .from("orders")
    .update({ status: "completed", paid_at: new Date().toISOString() })
    .eq("id", id);

  await serviceClient.from("transactions").insert({
    order_id: id,
    payment_method: paymentMethod,
    payment_status: "success",
    amount: found.total,
    confirmed_by: access.user.id,
  });

  for (const item of found.items) {
    if (!item.variant_id) continue;

    const { data: inv } = await serviceClient
      .from("inventory")
      .select("quantity, reserved_quantity")
      .eq("variant_id", item.variant_id)
      .maybeSingle();

    const current = inv as { quantity: number; reserved_quantity: number } | null;
    const newQuantity = (current?.quantity ?? 0) - item.quantity;
    const newReserved = Math.max(0, (current?.reserved_quantity ?? 0) - item.quantity);

    await serviceClient
      .from("inventory")
      .update({ quantity: newQuantity, reserved_quantity: newReserved, last_sold_at: new Date().toISOString() })
      .eq("variant_id", item.variant_id);

    await serviceClient.from("stock_movements").insert({
      variant_id: item.variant_id,
      delta: -item.quantity,
      reason: "sale_pos",
      order_id: id,
      actor_id: access.user.id,
    });
  }

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
