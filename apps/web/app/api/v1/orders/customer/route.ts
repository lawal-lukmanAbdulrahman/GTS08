import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError, dbError } from "../../_lib/http";

/** Only what a customer should see of their own order: no IP address, session, staff notes or cashier. */
const ORDER_COLUMNS = `
  id, order_number, channel, status, subtotal, delivery_fee, discount_amount, total, promo_code,
  carrier_name, tracking_number, carrier_tracking_url, paid_at, shipped_at, delivered_at, created_at, updated_at,
  items:order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot),
  address:addresses(full_name, phone, address_line1, address_line2, city, state)
`;

/**
 * The signed-in customer's own orders. Who they are comes from their sign-in and
 * nothing else: an email, customer id or user id in the address is ignored, so
 * one person can't read another's orders by asking for them.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser?.id) return NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });

    const client = createServiceClient();
    // Only characters that can't alter the filter expression may reach it.
    const safeEmail = (authUser.email ?? "").toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
    const filters = [`user_id.eq.${authUser.id}`];
    if (safeEmail) filters.push(`email.eq.${safeEmail}`);

    const { data: customers, error: customerError } = await client.from("customers").select("id").or(filters.join(","));
    if (customerError) return dbError(customerError, "DATABASE_ERROR", 500);
    const ids = [...new Set(((customers ?? []) as Array<{ id: string }>).map((c) => c.id))];
    if (ids.length === 0) return NextResponse.json({ success: true, data: [] });

    const { data: orders, error } = await client.from("orders").select(ORDER_COLUMNS).in("customer_id", ids).order("created_at", { ascending: false });
    if (error) return dbError(error, "DATABASE_ERROR", 500);
    return NextResponse.json({ success: true, data: orders ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
