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
import { afterResponse } from "../_lib/email/after";
import { notifyPickupOrder } from "../_lib/email/events";
import { computePromoDiscount, normalizePromoCode, type PromoRow, getOrderPickupPin } from "@gts/utils";

/** Every one of these is paid through Paystack, whose webhook is the only thing that marks an order paid. */
const PREPAID_METHODS = ["paystack", "card-transfer", "palmpay", "opay"];
/** Collected and paid for at the store; the order holds its items until the pickup deadline. */
const PAY_ON_PICKUP = "pay_on_pickup";
const DEFAULT_PICKUP_HOLD_HOURS = 48;
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/** Paying online is switched off until the live Paystack account is ready (PAYSTACK_ENABLED=true turns it on). */
const paystackEnabled = () => process.env.PAYSTACK_ENABLED?.trim().toLowerCase() === "true";

interface VariantRow {
  id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  price_modifier: number;
  is_active: boolean;
  inventory: { quantity: number; reserved_quantity: number } | null;
  product: {
    id: string;
    name: string;
    base_price: number;
    status: string;
    product_images?: Array<{ cloudinary_public_id: string; is_primary?: boolean; sort_order?: number; variant_id?: string | null }>;
  } | null;
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
    const { customer: customerInput, address: addressInput, items: rawItems, deliveryOption, paymentMethod, notes, pickupStationId } = body;

    // How the customer pays decides everything else, so it is checked first, before anything is read or held.
    const isPickup = paymentMethod === PAY_ON_PICKUP;
    if (!isPickup) {
      if (typeof paymentMethod !== "string" || !PREPAID_METHODS.includes(paymentMethod)) {
        return NextResponse.json({ error: "Choose how you'd like to pay.", code: "INVALID_PAYMENT_METHOD" }, { status: 400 });
      }
      if (!paystackEnabled()) {
        return NextResponse.json({ error: "Paying online isn't available yet. Choose pay on pickup.", code: "PAYMENT_UNAVAILABLE" }, { status: 503 });
      }
    }

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

    if (!isPickup && (!addressInput?.addressLine1 || !addressInput?.city || !addressInput?.state)) {
      return NextResponse.json(
        { error: "Missing required delivery address information.", code: "INVALID_ADDRESS" },
        { status: 400 }
      );
    }

    const deliveryFeeKobo = isPickup ? 0 : typeof deliveryOption === "string" ? DELIVERY_FEE_KOBO[deliveryOption] : undefined;
    if (deliveryFeeKobo === undefined) {
      return NextResponse.json({ error: "Choose a delivery option.", code: "INVALID_DELIVERY_OPTION" }, { status: 400 });
    }

    const email = sanitizeEmail(customerInput.email);
    const fullName = sanitizeSqlInput(customerInput.fullName);
    const phone = sanitizeSqlInput(customerInput.phone);
    const line1 = isPickup ? "" : sanitizeSqlInput(addressInput.addressLine1);
    const line2 = !isPickup && addressInput.addressLine2 ? sanitizeSqlInput(addressInput.addressLine2) : null;
    const city = isPickup ? "" : sanitizeSqlInput(addressInput.city);
    const state = isPickup ? "" : sanitizeSqlInput(addressInput.state);

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

    // 2. Create or Link Address Record (a pickup order has none: it is collected at the store)
    let addressId: string | null = null;
    if (!isPickup) {
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
      addressId = addrRecord?.id || null;
    }

    // Where and by when a pickup order is collected (Store Details or selected Pickup Station).
    let pickup: {
      hold_hours: number;
      deadline: string | null;
      store_name: string;
      address: string | null;
      station_id?: string | null;
      phone?: string | null;
      operating_hours?: string | null;
    } | null = null;
    let selectedStationId: string | null = null;

    if (isPickup) {
      const { data: settings } = await serviceClient.from("settings").select("*").eq("id", SETTINGS_ID).maybeSingle();
      const row = (settings ?? {}) as { pickup_hold_hours?: number | null; store_name?: string | null; store_address?: string | null; support_phone?: string | null };
      const holdHours = row.pickup_hold_hours && row.pickup_hold_hours > 0 ? row.pickup_hold_hours : DEFAULT_PICKUP_HOLD_HOURS;

      let stationName = row.store_name || "GTS";
      let stationAddress = row.store_address ?? null;
      let stationPhone = row.support_phone ?? null;
      let stationHours: string | null = null;

      try {
        if (pickupStationId) {
          const { data: station } = await serviceClient
            .from("pickup_stations")
            .select("*")
            .eq("id", pickupStationId)
            .maybeSingle();

          if (station) {
            selectedStationId = station.id;
            stationName = station.name;
            stationAddress = [station.address_line1, station.address_line2, station.city, station.state].filter(Boolean).join(", ");
            if (station.phone) stationPhone = station.phone;
            if (station.operating_hours) stationHours = station.operating_hours;
          }
        } else {
          // If no specific station requested, check for active default station
          const { data: defaultStation } = await serviceClient
            .from("pickup_stations")
            .select("*")
            .eq("is_active", true)
            .order("is_default", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (defaultStation) {
            selectedStationId = defaultStation.id;
            stationName = defaultStation.name;
            stationAddress = [defaultStation.address_line1, defaultStation.address_line2, defaultStation.city, defaultStation.state].filter(Boolean).join(", ");
            if (defaultStation.phone) stationPhone = defaultStation.phone;
            if (defaultStation.operating_hours) stationHours = defaultStation.operating_hours;
          }
        }
      } catch {
        // DB error or table issue
      }

      if (!selectedStationId) {
        return NextResponse.json(
          {
            error: "No active pickup stations are currently available for collection. An administrator must configure a pickup station before orders can be placed.",
            code: "NO_PICKUP_STATION",
          },
          { status: 400 }
        );
      }

      pickup = {
        hold_hours: holdHours,
        deadline: null,
        store_name: stationName,
        address: stationAddress,
        station_id: selectedStationId,
        phone: stationPhone,
        operating_hours: stationHours,
      };
    }

    // 3. Price the cart from the database.
    const { data: variantRows, error: variantError } = await serviceClient
      .from("product_variants")
      .select(
        `
        id, size, color, sku, price_modifier, is_active,
        inventory(quantity, reserved_quantity),
        product:products(
          id, name, base_price, status,
          product_images(cloudinary_public_id, is_primary, sort_order, variant_id)
        )
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

      const imgs = v.product?.product_images ?? [];
      const variantImg = imgs.find((img) => img.variant_id === v.id);
      const primaryImg =
        variantImg?.cloudinary_public_id ||
        imgs.find((img) => img.is_primary)?.cloudinary_public_id ||
        imgs.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.cloudinary_public_id ||
        null;

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
          image: primaryImg,
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
      if (held.reason === "DATABASE_ERROR") {
        if (/foreign key|violates foreign key|23503|not-null|does not exist|violates not-null/i.test(held.message)) {
          return NextResponse.json(
            {
              error: "An item in your order is no longer available.",
              code: "ITEM_UNAVAILABLE",
              details: { variant_id: held.failedVariantId },
            },
            { status: 409 }
          );
        }
        return serverError(new Error(held.message));
      }
      return NextResponse.json(
        {
          error: "One or more items no longer have enough stock or are no longer available.",
          code: "INSUFFICIENT_STOCK",
          details: { variant_id: held.failedVariantId, ...(held.reason === "INSUFFICIENT_STOCK" ? { available: held.available } : {}) },
        },
        { status: 409 }
      );
    }

    const releaseHolds = () => rollback(serviceClient, holds);

    // 5. The order, unpaid. (The database assigns the order number.)
    const orderPayload: Record<string, any> = {
      channel: isPickup ? "pickup" : "online",
      status: isPickup ? "placed" : "pending_payment",
      payment_status: "unpaid",
      pickup_deadline: null,
      customer_id: customerId,
      address_id: addressId,
      promo_code: appliedCode,
      subtotal: subtotalKobo,
      delivery_fee: deliveryFeeKobo,
      discount_amount: discountAmountKobo,
      total: grandTotalKobo,
      paid_at: null,
      internal_notes: notes ? sanitizeSqlInput(notes) : null,
    };
    if (selectedStationId) {
      orderPayload.pickup_station_id = selectedStationId;
    }

    let { data: order, error: orderErr } = await serviceClient
      .from("orders")
      .insert(orderPayload)
      .select("id, order_number, status, subtotal, delivery_fee, discount_amount, total")
      .single();

    // Fallback if test DB does not have newer pickup_station_id column
    if (orderErr && /pickup_station_id|payment_status/i.test(orderErr.message)) {
      delete orderPayload.pickup_station_id;
      delete orderPayload.payment_status;
      const retry = await serviceClient
        .from("orders")
        .insert(orderPayload)
        .select("id, order_number, status, subtotal, delivery_fee, discount_amount, total")
        .single();
      order = retry.data;
      orderErr = retry.error;
    }

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
      if (/foreign key|violates foreign key|23503|not-null|does not exist|violates not-null/i.test(itemsErr.message)) {
        return NextResponse.json(
          {
            error: "An item in your order is no longer available.",
            code: "ITEM_UNAVAILABLE",
          },
          { status: 409 }
        );
      }
      return serverError(new Error(itemsErr.message));
    }

    // A pickup order is paid at the till (POS), which confirms it; nothing is charged online.
    if (isPickup && pickup) {
      const pickupPin = getOrderPickupPin(order);
      try {
        const { error: pinErr } = await serviceClient
          .from("orders")
          .update({ tracking_number: pickupPin, pickup_pin: pickupPin })
          .eq("id", order.id);
        if (pinErr && /pickup_pin/i.test(pinErr.message)) {
          await serviceClient
            .from("orders")
            .update({ tracking_number: pickupPin })
            .eq("id", order.id);
        }
      } catch (pinErr) {
        console.warn("Failed to set tracking_number/pickup_pin on pickup order:", pinErr);
      }
      afterResponse(() => notifyPickupOrder(serviceClient, order.id));
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
          customer: { id: customerId, email, full_name: fullName, phone },
          pickup,
          payment: { method: PAY_ON_PICKUP, status: "pending" },
        },
      });
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
