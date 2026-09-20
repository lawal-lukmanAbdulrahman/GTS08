import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../_lib/http";

/** The reference is made by the server (gts_ + a random UUID), so it works as the key to look an order up by. */
const REFERENCE = /^gts_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A paid order is any state after payment; it only stops being "paid" if it was cancelled or voided.
const UNPAID = new Set(["pending_payment", "cancelled", "voided"]);

interface OrderRow {
  order_number: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  created_at: string;
  paid_at: string | null;
  items: Array<{ quantity: number; unit_price: number; line_total: number; product_snapshot: { name?: string; size?: string | null; color?: string | null } | null }> | null;
}

/**
 * Where a payment stands, for the page Paystack sends the customer back to.
 * Being back from Paystack proves nothing; this only reports what the webhook
 * has recorded. It says nothing about who the customer is.
 */
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  if (!REFERENCE.test(reference)) {
    return NextResponse.json({ error: "That payment reference isn't valid.", code: "INVALID_REFERENCE" }, { status: 400 });
  }

  try {
    const client = createServiceClient();
    const { data: tx, error: txError } = await client.from("transactions").select("order_id, payment_status").eq("paystack_reference", reference).maybeSingle();
    if (txError) return serverError(new Error(txError.message));
    if (!tx) return NextResponse.json({ error: "We couldn't find that payment.", code: "NOT_FOUND" }, { status: 404 });

    const { data, error } = await client
      .from("orders")
      .select("order_number, status, subtotal, delivery_fee, discount_amount, total, created_at, paid_at, items:order_items(quantity, unit_price, line_total, product_snapshot)")
      .eq("id", (tx as { order_id: string }).order_id)
      .maybeSingle();
    if (error) return serverError(new Error(error.message));
    const order = data as OrderRow | null;
    if (!order) return NextResponse.json({ error: "We couldn't find that payment.", code: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json(
      {
        data: {
          order_number: order.order_number,
          status: order.status,
          paid: !UNPAID.has(order.status),
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          discount_amount: order.discount_amount,
          total: order.total,
          created_at: order.created_at,
          paid_at: order.paid_at,
          items: (order.items ?? []).map((i) => ({
            name: i.product_snapshot?.name ?? "Item",
            size: i.product_snapshot?.size ?? null,
            color: i.product_snapshot?.color ?? null,
            quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: i.line_total,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError(err);
  }
}
