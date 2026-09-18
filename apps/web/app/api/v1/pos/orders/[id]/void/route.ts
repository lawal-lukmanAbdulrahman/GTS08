import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../../_lib/access";
import { sanitizeSqlInput } from "../../../../auth/utils";

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * gts_03_cashier_spec.md Part 6: cashier can void a same-day completed order,
 * which restores inventory and logs the reversal.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = body.reason ? sanitizeSqlInput(body.reason) : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A void reason is required.", code: "REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .select("id, status, created_at, cashier_id, items:order_items(variant_id, quantity)")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found.", code: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const found = order as unknown as {
    id: string;
    status: string;
    created_at: string;
    cashier_id: string | null;
    items: Array<{ variant_id: string | null; quantity: number }>;
  };

  if (!isToday(found.created_at)) {
    return NextResponse.json(
      { error: "Only same-day orders can be voided.", code: "NOT_TODAYS_ORDER" },
      { status: 409 }
    );
  }

  if (found.status === "voided") {
    return NextResponse.json(
      { error: "This order has already been voided.", code: "ALREADY_VOIDED" },
      { status: 409 }
    );
  }

  await serviceClient
    .from("orders")
    .update({ status: "voided", internal_notes: reason, updated_at: new Date().toISOString() })
    .eq("id", id);

  for (const item of found.items) {
    if (!item.variant_id) continue;

    const { data: inv } = await serviceClient
      .from("inventory")
      .select("quantity")
      .eq("variant_id", item.variant_id)
      .maybeSingle();

    const currentQuantity = (inv as { quantity: number } | null)?.quantity ?? 0;
    await serviceClient
      .from("inventory")
      .update({ quantity: currentQuantity + item.quantity })
      .eq("variant_id", item.variant_id);

    await serviceClient.from("stock_movements").insert({
      variant_id: item.variant_id,
      delta: item.quantity,
      reason: "void",
      order_id: id,
      actor_id: access.user.id,
      notes: reason,
    });
  }

  return NextResponse.json({ data: { id, status: "voided" } });
}
