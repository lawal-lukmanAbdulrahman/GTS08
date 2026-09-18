import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../_lib/access";
import { sanitizeEmail, sanitizeSqlInput } from "../../auth/utils";
import { computeCartTotals, type PosCartLine } from "../_lib/cart-totals";
import { checkStockSufficiency } from "../_lib/stock-sufficiency";
import { variantAvailable } from "../_lib/stock-status";

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

/**
 * D001 (docs/00-open-questions.md): a staff member records an order while
 * chatting with a customer on WhatsApp. It is created as pending_payment with
 * stock RESERVED (not yet decremented) so a walk-in sale can't oversell it
 * before a cashier confirms payment later via /pos/whatsapp-orders/:id/confirm.
 */
export async function POST(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  let body: {
    items?: OrderItemInput[];
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const items = body.items || [];
  if (items.length === 0) {
    return NextResponse.json({ error: "No items given.", code: "EMPTY_CART" }, { status: 400 });
  }

  const customerName = body.customer_name ? sanitizeSqlInput(body.customer_name) : "";
  const customerPhone = body.customer_phone ? sanitizeSqlInput(body.customer_phone) : "";
  if (!customerName || !customerPhone) {
    return NextResponse.json(
      {
        error: "Customer name and phone are required to reach them on WhatsApp about this order.",
        code: "CUSTOMER_CONTACT_REQUIRED",
      },
      { status: 400 }
    );
  }

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
        error: "One or more items do not have enough stock to reserve.",
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
  const totals = computeCartTotals(cartLines, 0);

  let customerId: string | null = null;
  const contactNote = `WhatsApp customer: ${customerName} (${customerPhone})`;
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
      const { data: created } = await serviceClient
        .from("customers")
        .insert({ email, full_name: customerName, phone: customerPhone })
        .select("id")
        .single();
      customerId = (created as { id: string } | null)?.id ?? null;
    }
  }

  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .insert({
      channel: "whatsapp",
      status: "pending_payment",
      customer_id: customerId,
      subtotal: totals.subtotal,
      discount_amount: 0,
      delivery_fee: 0,
      total: totals.total,
      cashier_id: access.user.id,
      internal_notes: contactNote,
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
      product_snapshot: { id: v.product.id, name: v.product.name, size: v.size, color: v.color, sku: v.sku },
    };
  });
  await serviceClient.from("order_items").insert(orderItemsPayload);

  for (const i of items) {
    const v = variantById.get(i.variant_id)!;
    const newReserved = (v.inventory?.reserved_quantity ?? 0) + i.quantity;
    await serviceClient.from("inventory").update({ reserved_quantity: newReserved }).eq("variant_id", i.variant_id);
  }

  return NextResponse.json({
    data: {
      order_id: createdOrder.id,
      order_number: createdOrder.order_number,
      status: createdOrder.status,
      total: createdOrder.total,
    },
  });
}
