import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@gts/database";
import { validateOrderItems } from "@gts/utils";
import { sanitizeEmail, sanitizeSqlInput, getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { serverError } from "../_lib/http";
import { adjustAll, rollback, type InventoryChange } from "../pos/_lib/inventory";

/** Delivery fees in kobo. The browser only chooses an option; the server owns the price. */
const DELIVERY_FEE_KOBO: Record<string, number> = {
  door: 150_000,
  pickup: 110_000,
  express: 450_000,
};

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
    // Only the variant and quantity are read from each line; a price sent by the browser is never looked at.
    const validItems = validateOrderItems(rawItems);
    if (!validItems.ok) {
      return NextResponse.json({ error: validItems.message, code: "INVALID_ITEMS" }, { status: 400 });
    }
    const items = validItems.items;

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

    const serviceClient = createServiceClient();
    const authUser = await getAuthenticatedUser(request);

    // 1. Get or Create Customer Record
    let customerId: string | null = null;
    if (authUser?.id) {
      const { data: existingCust } = await serviceClient
        .from("customers")
        .select("id")
        .or(`user_id.eq.${authUser.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
        // update phone or name if changed
        await serviceClient
          .from("customers")
          .update({ full_name: fullName, phone, user_id: authUser.id })
          .eq("id", customerId);
      } else {
        const { data: newCust, error: custErr } = await serviceClient
          .from("customers")
          .insert({
            user_id: authUser.id,
            email,
            full_name: fullName,
            phone,
          })
          .select("id")
          .single();

        if (!custErr && newCust) {
          customerId = newCust.id;
        }
      }
    } else {
      // Guest customer check
      const { data: guestCust } = await serviceClient
        .from("customers")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      if (guestCust) {
        customerId = guestCust.id;
        await serviceClient
          .from("customers")
          .update({ full_name: fullName, phone })
          .eq("id", customerId);
      } else {
        const { data: newCust, error: custErr } = await serviceClient
          .from("customers")
          .insert({
            email,
            full_name: fullName,
            phone,
          })
          .select("id")
          .single();

        if (!custErr && newCust) {
          customerId = newCust.id;
        }
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
    // No discount is applied here until promo codes are checked against real, server-side rules.
    const discountAmountKobo = 0;
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
        promo_code: null,
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
        },
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
});
