import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../../_lib/access";

/**
 * gts_03_cashier_spec.md Part 6: today's walk-in/whatsapp orders created by
 * this cashier, so mistakes can be voided same-day.
 */
export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("orders")
    .select(
      `
      id, order_number, status, total, created_at,
      items:order_items(id, quantity, unit_price, line_total, product_snapshot)
      `
    )
    .eq("cashier_id", access.user.id)
    .in("channel", ["walk_in", "whatsapp"])
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}
