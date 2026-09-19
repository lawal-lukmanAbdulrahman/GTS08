import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { parseWhatsAppContact } from "@gts/utils";
import { requirePosAccess } from "../../../_lib/access";
import { clientIp, logActivity } from "../../../../_lib/activity";

interface OrderRow {
  id: string;
  order_number: string;
  channel: "walk_in" | "whatsapp";
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  cashier_id: string | null;
  internal_notes: string | null;
  items: Array<{
    quantity: number;
    unit_price: number;
    line_total: number;
    product_snapshot: { name: string; size?: string | null; color?: string | null };
  }>;
}

/**
 * Reprint a receipt for a completed sale. Cashiers reprint only sales they
 * took payment for; admins any. Every reprint is audited, and the data is
 * flagged `duplicate` so the copy can't pass as the original.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("orders")
    .select(
      `id, order_number, channel, status, subtotal, discount_amount, total, created_at, cashier_id, internal_notes,
       items:order_items(quantity, unit_price, line_total, product_snapshot)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found.", code: "ORDER_NOT_FOUND" }, { status: 404 });
  }
  const order = data as unknown as OrderRow;

  const { data: payment } = await serviceClient
    .from("transactions")
    .select("confirmed_by, payment_method")
    .eq("order_id", id)
    .eq("payment_status", "success")
    .limit(1)
    .maybeSingle();
  const paid = payment as { confirmed_by: string | null; payment_method: "cash" | "pos_terminal" } | null;
  const owner = paid?.confirmed_by ?? order.cashier_id;

  if (!access.isAdmin && owner !== access.user.id) {
    return NextResponse.json(
      { error: "You can only reprint receipts for sales you took payment for.", code: "NOT_YOUR_SALE" },
      { status: 403 }
    );
  }
  if (order.status !== "completed" || !paid) {
    return NextResponse.json(
      { error: "A receipt can only be reprinted for a completed, paid sale.", code: "NOT_PRINTABLE" },
      { status: 409 }
    );
  }

  const { data: seller } = await serviceClient.from("users").select("full_name").eq("id", owner ?? access.user.id).maybeSingle();
  const cashierName = (seller as { full_name: string | null } | null)?.full_name ?? access.fullName;

  await logActivity(serviceClient, {
    actorId: access.user.id,
    action: "pos.receipt_reprint",
    targetType: "order",
    targetId: id,
    changes: { order_number: order.order_number },
    ip: clientIp(request),
  });

  const contact = order.channel === "whatsapp" ? parseWhatsAppContact(order.internal_notes) : null;

  return NextResponse.json({
    data: {
      orderNumber: order.order_number,
      channel: order.channel,
      items: order.items.map((i) => ({
        name: i.product_snapshot.name,
        size: i.product_snapshot.size ?? null,
        color: i.product_snapshot.color ?? null,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        lineTotal: i.line_total,
      })),
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      total: order.total,
      paymentMethod: paid.payment_method,
      cashierName,
      createdAt: order.created_at,
      customerName: contact?.name,
      customerPhone: contact?.phone,
      duplicate: true,
    },
  });
}
