import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@gts/database";
import { adjustAll, type InventoryChange } from "../../pos/_lib/inventory";
import { transitionOrderStatus } from "../../pos/_lib/order-status";
import { afterResponse } from "../../_lib/email/after";
import { notifyOrderPaid } from "../../_lib/email/events";

/** True only when the signature is the HMAC-SHA512 of the raw body under our secret. Constant-time. */
function signatureMatches(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Paystack webhook: the only thing that marks an online order paid.
 *
 *  1. The signature is verified before anything else, and can never be skipped:
 *     with no secret configured the route refuses to run (it never falls back
 *     to a default, which anyone could sign with).
 *  2. A payment only counts if its amount and currency match the order.
 *  3. The order is claimed with a compare-and-swap (pending_payment -> paid), so
 *     a replay, a cancelled order, or two deliveries at once can't double-apply stock.
 *  4. Failures return an error status so Paystack retries, instead of a 200 that
 *     silently loses the fulfilment.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payment webhook is not configured.", code: "WEBHOOK_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  if (!signatureMatches(rawBody, request.headers.get("x-paystack-signature"), secretKey)) {
    return NextResponse.json({ error: "Invalid signature", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: { event?: string; data?: Record<string, any> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const eventType = payload.event ?? "unknown";
    const eventId = payload.data?.reference || payload.data?.id?.toString() || crypto.randomUUID();
    const serviceClient = createServiceClient();

    // Idempotency: an event we already finished is acknowledged and ignored.
    const { data: existing } = await serviceClient
      .from("webhook_events")
      .select("id, processed")
      .eq("provider", "paystack")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing?.processed) {
      return NextResponse.json({ received: true, message: "Event already processed" }, { status: 200 });
    }

    const { data: eventRecord } = existing
      ? { data: existing }
      : await serviceClient
          .from("webhook_events")
          .insert({ provider: "paystack", event_type: eventType, event_id: eventId, payload, processed: false })
          .select("id")
          .single();

    const finish = async (flag?: string) => {
      if (!eventRecord?.id) return;
      await serviceClient
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          ...(flag ? { payload: { ...payload, _flag: flag } } : {}),
        })
        .eq("id", eventRecord.id);
    };

    if (eventType === "charge.success") {
      const reference = payload.data?.reference;

      const { data: transaction } = await serviceClient
        .from("transactions")
        .select("order_id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      const orderId = transaction?.order_id as string | undefined;

      if (orderId) {
        const { data: order } = await serviceClient
          .from("orders")
          .select("id, status, total")
          .eq("id", orderId)
          .maybeSingle();

        if (order) {
          // A payment only counts if it is for exactly what the order costs, in naira.
          const paidKobo = payload.data?.amount;
          const currency = payload.data?.currency ?? "NGN";
          if (paidKobo !== order.total || currency !== "NGN") {
            await finish("amount_mismatch");
            return NextResponse.json({ received: true, flagged: "amount_mismatch" }, { status: 200 });
          }

          const claimed = await transitionOrderStatus(serviceClient, orderId, "pending_payment", {
            status: "paid",
            paid_at: new Date().toISOString(),
          });

          if (claimed) {
            const { data: items } = await serviceClient.from("order_items").select("variant_id, quantity").eq("order_id", orderId);
            const changes: InventoryChange[] = ((items as Array<{ variant_id: string | null; quantity: number }>) || [])
              .filter((i) => i.variant_id)
              .map((i) => ({ variantId: i.variant_id as string, deltaQuantity: -i.quantity, deltaReserved: -i.quantity, clampReserved: true }));

            const stock = await adjustAll(serviceClient, changes);
            if (!stock.ok) {
              // Undo the claim so the retry can try again; Paystack redelivers on a non-2xx.
              await transitionOrderStatus(serviceClient, orderId, "paid", { status: "pending_payment", paid_at: null });
              return NextResponse.json({ error: "Could not update stock; please retry.", code: "STOCK_UPDATE_FAILED" }, { status: 503 });
            }

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

            if (changes.length > 0) {
              await serviceClient.from("stock_movements").insert(
                changes.map((c) => ({ variant_id: c.variantId, delta: c.deltaQuantity, reason: "sale_online", order_id: orderId }))
              );
            }

            afterResponse(() => notifyOrderPaid(serviceClient, orderId));
          }
        }
      }
    }

    await finish();
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    // A real failure must not look like success, or Paystack stops retrying and the payment is lost.
    return NextResponse.json(
      { error: "Webhook processing failed.", code: "WEBHOOK_FAILED" },
      { status: 500 }
    );
  }
}
