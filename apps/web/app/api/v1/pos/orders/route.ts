import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../_lib/access";
import { sanitizeEmail } from "../../auth/utils";
import { computeCartTotals, type PosCartLine } from "../_lib/cart-totals";
import { checkStockSufficiency } from "../_lib/stock-sufficiency";
import { variantAvailable } from "../_lib/stock-status";

const PAYMENT_METHODS = ["cash", "pos_terminal"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface OrderItemInput {
  variant_id: string;
  quantity: number;
}

interface VariantRow {
  id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  price_modifier: number;
  inventory: { quantity: number; reserved_quantity: number } | null;
  product: { id: string; name: string; base_price: number };
}

export async function POST(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  let body: {
    items?: OrderItemInput[];
    payment_method?: string;
    discount_amount?: number;
    promo_code?: string;
    customer_email?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const items = body.items || [];
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Cart is empty. Add products before confirming payment.", code: "EMPTY_CART" },
      { status: 400 }
    );
  }

  if (!PAYMENT_METHODS.includes(body.payment_method as PaymentMethod)) {
    return NextResponse.json(
      { error: "Payment method must be 'cash' or 'pos_terminal'.", code: "INVALID_PAYMENT_METHOD" },
      { status: 400 }
    );
  }
  const paymentMethod = body.payment_method as PaymentMethod;

  const serviceClient = createServiceClient();

  const variantIds = items.map((i) => i.variant_id);
  const { data: variantRows, error: variantError } = await serviceClient
    .from("product_variants")
    .select(
      `
      id, size, color, sku, price_modifier,
      inventory(quantity, reserved_quantity),
      product:products(id, name, base_price)
      `
    )
    .in("id", variantIds);

  if (variantError) {
    return NextResponse.json({ error: variantError.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  const variants = (variantRows || []) as unknown as VariantRow[];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const missing = items.find((i) => !variantById.has(i.variant_id));
  if (missing) {
    return NextResponse.json(
      { error: `Product variant not found: ${missing.variant_id}`, code: "VARIANT_NOT_FOUND" },
      { status: 400 }
    );
  }

  const available: Record<string, number> = {};
  for (const v of variants) {
    available[v.id] = v.inventory ? variantAvailable(v.inventory) : 0;
  }

  const stockCheck = checkStockSufficiency(
    items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })),
    available
  );
  if (!stockCheck.ok) {
    return NextResponse.json(
      {
        error: "One or more items no longer have sufficient stock.",
        code: "INSUFFICIENT_STOCK",
        details: stockCheck.insufficient,
      },
      { status: 409 }
    );
  }

  const cartLines: PosCartLine[] = items.map((i) => {
    const v = variantById.get(i.variant_id)!;
    return { unitPrice: v.product.base_price + v.price_modifier, quantity: i.quantity };
  });
  const totals = computeCartTotals(cartLines, body.discount_amount || 0);

  let customerId: string | null = null;
  if (body.customer_email) {
    const email = sanitizeEmail(body.customer_email);
    const { data: existing } = await serviceClient
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      customerId = (existing as { id: string }).id;
    } else {
      const { data: created, error: custError } = await serviceClient
        .from("customers")
        .insert({ email, full_name: "Walk-in Customer" })
        .select("id")
        .single();
      if (custError) {
        return NextResponse.json({ error: custError.message, code: "DATABASE_ERROR" }, { status: 500 });
      }
      customerId = (created as { id: string }).id;
    }
  }

  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .insert({
      channel: "walk_in",
      status: "completed",
      customer_id: customerId,
      promo_code: body.promo_code || null,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      delivery_fee: 0,
      total: totals.total,
      cashier_id: access.user.id,
      paid_at: new Date().toISOString(),
    })
    .select("id, order_number, total, status")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message || "Failed to create order.", code: "ORDER_CREATION_FAILED" },
      { status: 500 }
    );
  }
  const createdOrder = order as { id: string; order_number: string; total: number; status: string };

  const orderItemsPayload = items.map((i) => {
    const v = variantById.get(i.variant_id)!;
    const unitPrice = v.product.base_price + v.price_modifier;
    return {
      order_id: createdOrder.id,
      variant_id: i.variant_id,
      quantity: i.quantity,
      unit_price: unitPrice,
      line_total: unitPrice * i.quantity,
      product_snapshot: {
        id: v.product.id,
        name: v.product.name,
        size: v.size,
        color: v.color,
        sku: v.sku,
      },
    };
  });
  await serviceClient.from("order_items").insert(orderItemsPayload);

  await serviceClient.from("transactions").insert({
    order_id: createdOrder.id,
    payment_method: paymentMethod,
    payment_status: "success",
    amount: totals.total,
    confirmed_by: access.user.id,
  });

  for (const i of items) {
    const v = variantById.get(i.variant_id)!;
    const newQuantity = (v.inventory?.quantity ?? 0) - i.quantity;
    await serviceClient
      .from("inventory")
      .update({ quantity: newQuantity, last_sold_at: new Date().toISOString() })
      .eq("variant_id", i.variant_id);

    await serviceClient.from("stock_movements").insert({
      variant_id: i.variant_id,
      delta: -i.quantity,
      reason: "sale_pos",
      order_id: createdOrder.id,
      actor_id: access.user.id,
    });
  }

  return NextResponse.json({
    data: {
      order_id: createdOrder.id,
      order_number: createdOrder.order_number,
      status: createdOrder.status,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      total: createdOrder.total,
      payment_method: paymentMethod,
    },
  });
}
