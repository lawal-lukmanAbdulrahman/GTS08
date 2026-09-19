import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../_lib/access";

/**
 * D001: a cashier looks up an order a customer placed earlier over WhatsApp,
 * using the order number the customer was given at creation time.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { ref } = await context.params;
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("orders")
    .select(
      `
      id, order_number, channel, status, total, internal_notes,
      items:order_items(id, quantity, unit_price, line_total, product_snapshot)
      `
    )
    .eq("order_number", ref)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: `No WhatsApp order found for number: ${ref}`, code: "ORDER_NOT_FOUND" },
      { status: 404 }
    );
  }

  const order = data as { status: string };
  if (order.status !== "pending_payment") {
    return NextResponse.json(
      {
        error: `This order is already '${order.status}' and cannot be confirmed again.`,
        code: "ORDER_NOT_PENDING",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ data });
}
