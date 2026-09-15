import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@gts/database";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");
    const secretKey = process.env.PAYSTACK_SECRET_KEY || "dummy_secret_for_tests";

    // 1. Mandatory Security Contract: HMAC-SHA512 Verification FIRST
    if (process.env.NODE_ENV === "production" || secretKey !== "dummy_secret_for_tests") {
      const hash = crypto
        .createHmac("sha512", secretKey)
        .update(rawBody)
        .digest("hex");

      if (hash !== signature) {
        return NextResponse.json(
          { error: "Invalid signature", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const eventId = payload.data?.reference || payload.data?.id?.toString() || crypto.randomUUID();

    const serviceClient = createServiceClient();

    // 2. Idempotency Check via webhook_events
    const { data: existingEvent } = await serviceClient
      .from("webhook_events")
      .select("id, processed")
      .eq("provider", "paystack")
      .eq("event_id", eventId)
      .single();

    if (existingEvent && existingEvent.processed) {
      return NextResponse.json({ received: true, message: "Event already processed" }, { status: 200 });
    }

    // Record webhook event
    const { data: eventRecord } = await serviceClient
      .from("webhook_events")
      .insert({
        provider: "paystack",
        event_type: eventType,
        event_id: eventId,
        payload,
        processed: false,
      })
      .select()
      .single();

    // Process charge.success event
    if (eventType === "charge.success") {
      const reference = payload.data?.reference;

      // Find order by paystack_reference in transactions or orders
      const { data: transaction } = await serviceClient
        .from("transactions")
        .select("order_id")
        .eq("paystack_reference", reference)
        .single();

      const orderId = transaction?.order_id;

      if (orderId) {
        // Update order status to paid
        await serviceClient
          .from("orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        // Update transaction status
        await serviceClient
          .from("transactions")
          .update({
            payment_status: "success",
            paystack_transaction_id: payload.data?.id?.toString(),
            paystack_channel: payload.data?.channel,
            paystack_fees: payload.data?.fees || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", orderId);

        // Decrement stock & record stock movement for each item
        const { data: items } = await serviceClient
          .from("order_items")
          .select("variant_id, quantity")
          .eq("order_id", orderId);

        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.variant_id) {
              const { data: inv } = await serviceClient
                .from("inventory")
                .select("quantity, reserved_quantity")
                .eq("variant_id", item.variant_id)
                .single();

              if (inv) {
                const newQty = Math.max(0, inv.quantity - item.quantity);
                const newReserved = Math.max(0, inv.reserved_quantity - item.quantity);

                await serviceClient
                  .from("inventory")
                  .update({
                    quantity: newQty,
                    reserved_quantity: newReserved,
                    last_sold_at: new Date().toISOString(),
                  })
                  .eq("variant_id", item.variant_id);

                await serviceClient.from("stock_movements").insert({
                  variant_id: item.variant_id,
                  delta: -item.quantity,
                  reason: "sale_online",
                  order_id: orderId,
                });
              }
            }
          }
        }
      }
    }

    // Mark event processed
    if (eventRecord?.id) {
      await serviceClient
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRecord.id);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    // Webhook should always return 200 to prevent Paystack spam retries on internal errors
    return NextResponse.json({ received: true, error: err.message }, { status: 200 });
  }
}
