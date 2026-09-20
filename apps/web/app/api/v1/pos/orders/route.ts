import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../_lib/access";
import { sanitizeEmail } from "../../auth/utils";
import { checkManualDiscount, computeCartTotals, startOfWATDay, type PosCartLine, validateOrderItems } from "@gts/utils";
import { checkStockSufficiency } from "../_lib/stock-sufficiency";
import { variantAvailable } from "../_lib/stock-status";
import { adjustAll, rollback, type InventoryChange } from "../_lib/inventory";
import { clientIp, logActivity } from "../../_lib/activity";
import { serverError } from "../../_lib/http";
import { afterResponse } from "../../_lib/email/after";
import { notifyPosReceipt } from "../../_lib/email/events";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD from the query as the start of that day in Lagos, or null if it isn't a real date. */
function lagosDay(text: string | null): Date | null {
  if (!text || !DATE_ONLY.test(text)) return null;
  const noon = new Date(`${text}T12:00:00+01:00`);
  return Number.isNaN(noon.getTime()) ? null : startOfWATDay(noon);
}

/**
 * Find past walk-in and WhatsApp sales by order number and/or date, so a receipt
 * can be reprinted for a customer who comes back later. A cashier finds only the
 * sales they took payment for; an admin can find any. Newest first, at most 30.
 */
export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || "").replace(/[^A-Za-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 30);
  const from = lagosDay(params.get("from")) ?? new Date(startOfWATDay(new Date()).getTime() - 29 * DAY_MS);
  const toDay = lagosDay(params.get("to"));
  const limit = Math.min(Math.max(1, parseInt(params.get("limit") || "20", 10) || 20), 30);

  const owned = !access.isAdmin;
  let query = createServiceClient()
    .from("orders")
    .select(`id, order_number, channel, status, total, created_at${owned ? ", transactions!inner(confirmed_by)" : ""}`)
    .in("channel", ["walk_in", "whatsapp"])
    .gte("created_at", from.toISOString());
  if (toDay) query = query.lt("created_at", new Date(toDay.getTime() + DAY_MS).toISOString());
  if (owned) query = query.eq("transactions.confirmed_by", access.user.id);
  if (q) query = query.ilike("order_number", `%${q}%`);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) return serverError(new Error(error.message));

  const rows = ((data || []) as unknown as Array<Record<string, unknown>>).map(({ transactions: _t, ...order }) => order);
  return NextResponse.json({ data: rows });
}

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

function stockFailureResponse(
  failure: Exclude<Awaited<ReturnType<typeof adjustAll>>, { ok: true }>,
  items: OrderItemInput[]
) {
  if (failure.reason === "INSUFFICIENT_STOCK") {
    const requested = items.find((i) => i.variant_id === failure.failedVariantId)?.quantity ?? 0;
    return NextResponse.json(
      {
        error: "One or more items no longer have sufficient stock.",
        code: "INSUFFICIENT_STOCK",
        details: [{ variantId: failure.failedVariantId, requested, available: failure.available }],
      },
      { status: 409 }
    );
  }
  if (failure.reason === "CONTENTION") {
    return NextResponse.json(
      { error: "The till is busy updating that item's stock. Please try again.", code: "STOCK_BUSY" },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: failure.message, code: "DATABASE_ERROR" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  let body: {
    items?: OrderItemInput[];
    payment_method?: string;
    /** Kobo. Needs can_apply_discounts; a cashier is capped at 20% of the subtotal. */
    manual_discount?: unknown;
    customer_email?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "Cart is empty. Add products before confirming payment.", code: "EMPTY_CART" },
      { status: 400 }
    );
  }
  const validItems = validateOrderItems(body.items);
  if (!validItems.ok) {
    return NextResponse.json({ error: validItems.message, code: "INVALID_ITEMS" }, { status: 400 });
  }
  const items = validItems.items;

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
  // The discount is decided here, never taken on trust from the client, and
  // before any stock is touched so a refusal leaves nothing to undo.
  const subtotal = computeCartTotals(cartLines, 0).subtotal;
  const requestedDiscount = body.manual_discount ?? 0;
  const discountCheck = checkManualDiscount({
    amount: requestedDiscount,
    subtotal,
    isAdmin: access.isAdmin,
    canApply: access.permissions.can_apply_discounts,
  });
  if (!discountCheck.ok) {
    return NextResponse.json(
      {
        error: discountCheck.message,
        code: discountCheck.code,
        details: discountCheck.maxAmount === undefined ? undefined : { maxAmount: discountCheck.maxAmount },
      },
      { status: discountCheck.code === "INVALID_DISCOUNT" ? 400 : 403 }
    );
  }
  const totals = computeCartTotals(cartLines, requestedDiscount as number);

  const stockChanges: InventoryChange[] = items.map((i) => ({
    variantId: i.variant_id,
    deltaQuantity: -i.quantity,
    requireAvailable: i.quantity,
  }));
  const stockResult = await adjustAll(serviceClient, stockChanges);
  if (!stockResult.ok) {
    return stockFailureResponse(stockResult, items);
  }

  let customerId: string | null = null;
  let receiptEmail: string | null = null;
  if (body.customer_email) {
    const email = sanitizeEmail(body.customer_email);
    receiptEmail = email;
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
        await rollback(serviceClient, stockChanges);
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
      promo_code: null,
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
    await rollback(serviceClient, stockChanges);
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

  await serviceClient.from("stock_movements").insert(
    items.map((i) => ({
      variant_id: i.variant_id,
      delta: -i.quantity,
      reason: "sale_pos",
      order_id: createdOrder.id,
      actor_id: access.user.id,
    }))
  );

  const ip = clientIp(request);
  await logActivity(serviceClient, {
    actorId: access.user.id,
    action: "pos.sale",
    targetType: "order",
    targetId: createdOrder.id,
    changes: {
      order_number: createdOrder.order_number,
      total: createdOrder.total,
      payment_method: paymentMethod,
      item_count: items.reduce((n, i) => n + i.quantity, 0),
    },
    ip,
  });
  if (totals.discountAmount > 0) {
    await logActivity(serviceClient, {
      actorId: access.user.id,
      action: "pos.manual_discount",
      targetType: "order",
      targetId: createdOrder.id,
      changes: {
        amount: totals.discountAmount,
        subtotal: totals.subtotal,
        share_bps: Math.round((totals.discountAmount * 10000) / totals.subtotal),
      },
      ip,
    });
  }

  if (receiptEmail) {
    const to = receiptEmail;
    afterResponse(() =>
      notifyPosReceipt(serviceClient, {
        to,
        orderNumber: createdOrder.order_number,
        createdAt: new Date().toISOString(),
        items: orderItemsPayload.map((r) => ({
          name: r.product_snapshot.name,
          size: r.product_snapshot.size,
          color: r.product_snapshot.color,
          quantity: r.quantity,
          unitPrice: r.unit_price,
          lineTotal: r.line_total,
        })),
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        total: createdOrder.total,
        paymentMethod,
        cashierName: access.fullName,
      })
    );
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
