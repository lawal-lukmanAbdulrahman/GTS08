import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { sanitizeEmail, sanitizeSqlInput, getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer: customerInput,
      address: addressInput,
      items,
      deliveryOption,
      paymentMethod,
      promoCode,
      discountPercent = 0,
      notes,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty. Please add items to checkout.", code: "EMPTY_CART" },
        { status: 400 }
      );
    }

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

    // 3. Compute Totals in Kobo (1 Naira = 100 Kobo)
    let subtotalKobo = 0;
    const orderItemsPayload: any[] = [];

    for (const item of items) {
      // item.product.priceNum is in Naira -> convert to kobo (* 100)
      const unitPriceNaira = Number(item.price || item.product?.priceNum || 0);
      const unitPriceKobo = Math.round(unitPriceNaira * 100);
      const qty = Math.max(1, Number(item.quantity || 1));
      const lineTotalKobo = unitPriceKobo * qty;

      subtotalKobo += lineTotalKobo;

      orderItemsPayload.push({
        variant_id: item.variant_id || null,
        quantity: qty,
        unit_price: unitPriceKobo,
        line_total: lineTotalKobo,
        product_snapshot: {
          id: item.product?.id || item.id,
          name: item.product?.title || item.title || "Product",
          image: item.product?.image || item.image || null,
          size: item.size || null,
          color: item.color || null,
          sku: item.product?.sku || item.sku || null,
        },
      });
    }

    const discountAmountKobo = discountPercent > 0
      ? Math.round((subtotalKobo * discountPercent) / 100)
      : 0;

    let deliveryFeeKobo = 1500 * 100; // default door delivery
    if (deliveryOption === "pickup") deliveryFeeKobo = 500 * 100;
    else if (deliveryOption === "express") deliveryFeeKobo = 4500 * 100;

    const grandTotalKobo = Math.max(0, subtotalKobo - discountAmountKobo + deliveryFeeKobo);

    // 4. Generate unique order number: GTS-YYYYMM-XXXXXX
    const datePrefix = new Date().toISOString().slice(0, 7).replace("-", "");
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `GTS-${datePrefix}-${randomSuffix}`;

    // 5. Determine Payment Status & Method
    const isPrepaid = ["paystack", "card-transfer", "palmpay", "opay"].includes(paymentMethod);
    const orderStatus = isPrepaid ? "paid" : "pending_payment";
    const mappedPaymentMethod = isPrepaid ? "paystack_card" : "cash";
    const paystackRef = `gts_ref_${Date.now()}_${randomSuffix}`;

    // 6. Insert Order into Supabase
    const { data: order, error: orderErr } = await serviceClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        channel: "online",
        status: orderStatus,
        customer_id: customerId,
        address_id: addressId,
        promo_code: promoCode || null,
        subtotal: subtotalKobo,
        delivery_fee: deliveryFeeKobo,
        discount_amount: discountAmountKobo,
        total: grandTotalKobo,
        paid_at: isPrepaid ? new Date().toISOString() : null,
        internal_notes: notes ? sanitizeSqlInput(notes) : null,
      })
      .select("*")
      .single();

    if (orderErr || !order) {
      console.error("Order insertion error:", orderErr);
      return NextResponse.json(
        { error: orderErr?.message || "Failed to create order.", code: "ORDER_CREATION_FAILED" },
        { status: 500 }
      );
    }

    // 7. Insert Order Items
    const itemsToInsert = orderItemsPayload.map((it) => ({
      ...it,
      order_id: order.id,
    }));

    const { error: itemsErr } = await serviceClient.from("order_items").insert(itemsToInsert);
    if (itemsErr) {
      console.warn("Error inserting order items:", itemsErr);
    }

    // 8. Record Transaction (Paystack Simulation / COD)
    await serviceClient.from("transactions").insert({
      order_id: order.id,
      payment_method: mappedPaymentMethod,
      payment_status: isPrepaid ? "success" : "pending",
      amount: grandTotalKobo,
      paystack_reference: paystackRef,
    });

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
          status: isPrepaid ? "success" : "pending",
        },
      },
    });
  } catch (err: any) {
    console.error("Checkout fatal error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during checkout.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
});
