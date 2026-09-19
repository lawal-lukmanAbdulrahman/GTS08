import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../../_lib/access";
import { adjustAll, type InventoryChange } from "../../../_lib/inventory";
import { transitionOrderStatus } from "../../../_lib/order-status";
import { sanitizeSqlInput } from "../../../../auth/utils";

/**
 * Cancels a WhatsApp order that was never paid (customer went quiet, changed
 * their mind) and releases the stock it reserved. Paid orders are voided
 * instead (PUT /pos/orders/:id/void).
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { ref: id } = await context.params;

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = body.reason ? sanitizeSqlInput(body.reason) : "";
  if (!reason) {
    return NextResponse.json({ error: "A cancel reason is required.", code: "REASON_REQUIRED" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("orders")
    .select("id, channel, status, internal_notes, items:order_items(variant_id, quantity)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found.", code: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const order = data as unknown as {
    id: string;
    channel: string;
    status: string;
    internal_notes: string | null;
    items: Array<{ variant_id: string | null; quantity: number }>;
  };

  if (order.channel !== "whatsapp") {
    return NextResponse.json(
      { error: "Only WhatsApp orders can be cancelled here. Void a walk-in sale instead.", code: "NOT_CANCELLABLE" },
      { status: 409 }
    );
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: `This order is already '${order.status}' and can't be cancelled.`, code: "ORDER_NOT_PENDING" },
      { status: 409 }
    );
  }

  const notes = [order.internal_notes, `Cancelled: ${reason}`].filter(Boolean).join("\n");
  const claimed = await transitionOrderStatus(serviceClient, id, "pending_payment", {
    status: "cancelled",
    internal_notes: notes,
  });
  if (!claimed) {
    return NextResponse.json(
      { error: "This order was just changed by someone else.", code: "ORDER_NOT_PENDING" },
      { status: 409 }
    );
  }

  const release: InventoryChange[] = order.items
    .filter((item) => item.variant_id)
    .map((item) => ({ variantId: item.variant_id as string, deltaReserved: -item.quantity }));
  await adjustAll(serviceClient, release);

  return NextResponse.json({ data: { id, status: "cancelled" } });
}
