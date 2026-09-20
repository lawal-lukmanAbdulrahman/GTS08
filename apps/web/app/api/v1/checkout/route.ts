import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@gts/database";
import { sanitizeEmail, sanitizeSqlInput, getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { serverError } from "../_lib/http";
import { adjustAll, rollback, type InventoryChange } from "../pos/_lib/inventory";
import { DELIVERY_FEE_KOBO, resolveCartLines } from "../_lib/checkout-cart";
import { initializePayment } from "../_lib/paystack";
import { computePromoDiscount, normalizePromoCode, type PromoRow } from "@gts/utils";

/** Every one of these is paid through Paystack, whose webhook is the only thing that marks an order paid. */
const PREPAID_METHODS = ["paystack", "card-transfer", "palmpay", "opay"];

interface VariantRow {
  id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  price_modifier: number;
  is_active: boolean;
  inventory: { quantity: number; reserved_quantity: number } | null;
  product: { id: string; name: string; base_price: number; status: string } | null;
}

/**
 * Online checkout. Everything that matters is decided here, never taken on trust
 * from the browser: prices come from the database, there is no client-supplied
 * discount, and the order is created unpaid ("pending_payment") with its stock held.
 * It only becomes paid when the Paystack webhook confirms the exact amount.
 * Unpaid orders are cancelled, and their stock freed, by the expire-orders job.
 */
export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
    }
    const { customer: customerInput, address: addressInput, items: rawItems, deliveryOption, paymentMethod, notes } = body;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty. Please add items to checkout.", code: "EMPTY_CART" },
        { status: 400 }
      );
    }
    // Only what to buy and how many is read from each line; a price sent by the browser is never looked at.
    const serviceClient = createServiceClient();
    const resolved = await resolveCartLines(serviceClient, rawItems);
    if (!resolved.ok) {
      const status = resolved.code === "DATABASE_ERROR" ? 500 : 400;
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status });
    }
    const items = resolved.items;

    if (!customerInput?.email || !customerInput?.fullName || !customerInput?.phone) {
      return NextResponse.json(
        { error: "Missing required contact details (name, email, or phone).", code: "INVALID_CUSTOMER" },
        { status: 400 }
      );
    }

    if (!addressInput?.addressLine1 || !addressInput?.city || !addressInput?.state) {
      return NextResponse.json(
        { error: "Missing required delivery address information.", code: "INVALID_ADDRESS" },
        { status: 400 }
      );
    }

    if (typeof paymentMethod !== "string" || !PREPAID_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Choose an online payment method.", code: "INVALID_PAYMENT_METHOD" },
        { status: 400 }
      );
    }

    const deliveryFeeKobo = typeof deliveryOption === "string" ? DELIVERY_FEE_KOBO[deliveryOption] : undefined;
    if (deliveryFeeKobo === undefined) {
      return NextResponse.json({ error: "Choose a delivery option.", code: "INVALID_DELIVERY_OPTION" }, { status: 400 });
    }

    const email = sanitizeEmail(customerInput.email);
    const fullName = sanitizeSqlInput(customerInput.fullName);
    const phone = sanitizeSqlInput(customerInput.phone);
    const line1 = sanitizeSqlInput(addressInput.addressLine1);
    const line2 = addressInput.addressLine2 ? sanitizeSqlInput(addressInput.addressLine2) : null;
    const city = sanitizeSqlInput(addressInput.city);
    const state = sanitizeSqlInput(addressInput.state);

    const authUser = await getAuthenticatedUser(request);

    // 1. Find or create the customer record. Who an order belongs to is never decided by what was typed into the form:
    //    a signed-in person is matched by their account (and their own verified email), and a record that belongs to
    //    someone else is never reused, updated or taken over.
    let customerId: string | null = null;
    if (authUser?.id) {
      const accountEmail = sanitizeEmail(authUser.email ?? email);
      let { data: own } = await serviceClient.from("customers").select("id, user_id").eq("user_id", authUser.id).limit(1).maybeSingle();
      if (own && (own as { user_id?: string | null }).user_id !== authUser.id) own = null;
      if (!own) {
        const { data: byEmail } = await serviceClient.from("customers").select("id, user_id").eq("email", accountEmail).limit(1).maybeSingle();
        // Only an unclaimed record with their own email can be adopted.
        if (byEmail && (byEmail as { user_id?: string | null }).user_id == null) own = byEmail;
      }
      if (own) {
        customerId = (own as { id: string }).id;
        // Contact details only; the record's owner is never changed here.
        await serviceClient.from("customers").update({ full_name: fullName, phone }).eq("id", customerId);
      } else {
        const { data: created, error: custErr } = await serviceClient
          .from("customers")
          .insert({ user_id: authUser.id, email: accountEmail, full_name: fullName, phone })
          .select("id")
          .single();
        if (!custErr && created) customerId = created.id;
      }
    } else {
      // A guest gets a record of their own. An earlier guest record for the same email is reused untouched;
      // a registered customer's record is never reused or changed by someone who isn't signed in.
      const { data: guestCust } = await serviceClient.from("customers").select("id, user_id").eq("email", email).limit(1).maybeSingle();
      if (guestCust && (guestCust as { user_id?: string | null }).user_id == null) {
        customerId = (guestCust as { id: string }).id;
      } else {
        const { data: created, error: custErr } = await serviceClient.from("customers").insert({ email, full_name: fullName, phone }).select("id").single();
        if (!custErr && created) customerId = created.id;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Failed to initialize customer account.", code: "CUSTOMER_CREATION_FAILED" },
        { status: 500 }
      );
    }

    // 2. Create or Link Address Record
    const { data: addrRecord } = await serviceClient
      .from("addresses")
      .insert({
        customer_id: customerId,
        full_name: fullName,
        phone,
        address_line1: line1,
        address_line2: line2,
        city,
        state,
        is_default: addressInput.isDefault || false,
      })
      .select("id")
      .single();

    const addressId = addrRecord?.id || null;

    // 3. Price the cart from the database.
    const { data: variantRows, error: variantError } = await serviceClient
      .from("product_variants")
      .select(
        `
        id, size, color, sku, price_modifier, is_active,
        inventory(quantity, reserved_quantity),
        product:products(id, name, base_price, status)
        `
      )
      .in("id", items.map((i) => i.variant_id));
    if (variantError) return serverError(new Error(variantError.message));

    const variantById = new Map(((variantRows || []) as unknown as VariantRow[]).map((v) => [v.id, v]));
    const unavailable = items.filter((i) => {
      const v = variantById.get(i.variant_id);
      return !v || !v.is_active || !v.product || v.product.status !== "active";
    });
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: "Some items in your cart are no longer available.",
          code: "ITEM_UNAVAILABLE",
          details: { variant_ids: unavailable.map((i) => i.variant_id) },
        },
        { status: 400 }
      );
    }

    let subtotalKobo = 0;
    const orderItemsPayload = items.map((i) => {
      const v = variantById.get(i.variant_id)!;
      const unitPrice = v.product!.base_price + v.price_modifier;
      const lineTotal = unitPrice * i.quantity;
      subtotalKobo += lineTotal;
      return {
        variant_id: i.variant_id,
        quantity: i.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        product_snapshot: {
          id: v.product!.id,
          name: v.product!.name,
          size: v.size,
          color: v.color,
          sku: v.sku,
        },
      };
    });
    // A discount comes only from a promo code the server has checked against its own rules and subtotal.
    let discountAmountKobo = 0;
    let appliedCode: string | null = null;
    if (body.promoCode !== undefined && body.promoCode !== null && body.promoCode !== "") {
      const code = normalizePromoCode(body.promoCode);
      const { data: promo, error: promoError } = code
        ? await serviceClient.from("promos").select("code, discount_type, discount_value, min_order_amount, max_uses, used_count, starts_at, expires_at, is_active").eq("code", code).maybeSingle()
        : { data: null, error: null };
      if (promoError) return serverError(new Error(promoError.message));
      const result = promo ? computePromoDiscount(promo as unknown as PromoRow, subtotalKobo) : ({ ok: false, reason: "INVALID_PROMO" } as const);
      if (!result.ok) {
        return result.reason === "MIN_ORDER"
          ? NextResponse.json({ error: "Your order is a little under the minimum for this code.", code: "MIN_ORDER", details: { short_by: result.shortBy } }, { status: 400 })
          : NextResponse.json({ error: "That promo code isn't valid.", code: "INVALID_PROMO" }, { status: 400 });
      }
      discountAmountKobo = result.discount;
      appliedCode = code;
    }
    const grandTotalKobo = subtotalKobo - discountAmountKobo + deliveryFeeKobo;

    // 4. Hold the stock. This refuses the whole order if any line isn't available.
    const holds: InventoryChange[] = items.map((i) => ({ variantId: i.variant_id, deltaReserved: i.quantity, requireAvailable: i.quantity }));
    const held = await adjustAll(serviceClient, holds);
    if (!held.ok) {
      if (held.reason === "DATABASE_ERROR") return serverError(new Error(held.message));
      return NextResponse.json(
        {
          error: "One or more items no longer have enough stock.",
          code: "INSUFFICIENT_STOCK",
          details: { variant_id: held.failedVariantId, ...(held.reason === "INSUFFICIENT_STOCK" ? { available: held.available } : {}) },
        },
        { status: 409 }
      );
    }

    const releaseHolds = () => rollback(serviceClient, holds);

    // 5. The order, unpaid. (The database assigns the order number.)
    const { data: order, error: orderErr } = await serviceClient
      .from("orders")
      .insert({
        channel: "online",
        status: "pending_payment",
        customer_id: customerId,
        address_id: addressId,
        promo_code: appliedCode,
        subtotal: subtotalKobo,
        delivery_fee: deliveryFeeKobo,
        discount_amount: discountAmountKobo,
        total: grandTotalKobo,
        paid_at: null,
        internal_notes: notes ? sanitizeSqlInput(notes) : null,
      })
      .select("id, order_number, status, subtotal, delivery_fee, discount_amount, total")
      .single();

    if (orderErr || !order) {
      await releaseHolds();
      return serverError(new Error(orderErr?.message || "order insert failed"));
    }

    const { error: itemsErr } = await serviceClient
      .from("order_items")
      .insert(orderItemsPayload.map((it) => ({ ...it, order_id: order.id })));
    if (itemsErr) {
      // An order with no lines can never be fulfilled: cancel it and free the stock.
      await serviceClient.from("orders").update({ status: "cancelled", internal_notes: "Cancelled: order lines could not be saved." }).eq("id", order.id);
      await releaseHolds();
      return serverError(new Error(itemsErr.message));
    }

    // 6. The payment record the webhook will match on. An unguessable reference.
    const paystackRef = `gts_${crypto.randomUUID()}`;
    const { error: txErr } = await serviceClient.from("transactions").insert({
      order_id: order.id,
      payment_method: "paystack_card",
      payment_status: "pending",
      amount: grandTotalKobo,
      paystack_reference: paystackRef,
    });
    if (txErr) {
      await serviceClient.from("orders").update({ status: "cancelled", internal_notes: "Cancelled: payment record could not be saved." }).eq("id", order.id);
      await releaseHolds();
      return serverError(new Error(txErr.message));
    }

    const storefront = (process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002").replace(/\/+$/, "");
    const payment = await initializePayment({
      email,
      amountKobo: grandTotalKobo,
      reference: paystackRef,
      callbackUrl: `${storefront}/checkout/complete`,
      metadata: { order_id: order.id, order_number: order.order_number },
    });
    if (!payment.ok) {
      // No way to pay means no order: free the stock rather than leave it held until expiry.
      await serviceClient.from("orders").update({ status: "cancelled", internal_notes: "Cancelled: payment could not be started." }).eq("id", order.id);
      await releaseHolds();
      return NextResponse.json(
        { error: "Online payment isn't available right now. Please try again shortly.", code: "PAYMENT_UNAVAILABLE" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        order_number: order.order_number,
        status: order.status,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        discount_amount: order.discount_amount,
        total: order.total,
        customer: {
          id: customerId,
          email,
          full_name: fullName,
          phone,
        },
        payment: {
          method: paymentMethod,
          reference: paystackRef,
          status: "pending",
          authorization_url: payment.authorizationUrl,
        },
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
});
