import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get("order_number");
    const email = searchParams.get("email");

    if (!orderNumber || !email) {
      return NextResponse.json(
        { error: "order_number and email are required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Fetch order matching order_number AND customer email
    const { data: order, error } = await serviceClient
      .from("orders")
      .select(
        `
        id,
        order_number,
        status,
        channel,
        subtotal,
        delivery_fee,
        discount_amount,
        total,
        carrier_name,
        tracking_number,
        carrier_tracking_url,
        paid_at,
        shipped_at,
        delivered_at,
        created_at,
        customer:customers(full_name, email, phone),
        address:addresses(full_name, phone, address_line1, address_line2, city, state),
        items:order_items(id, quantity, unit_price, line_total, product_snapshot)
      `
      )
      .eq("order_number", orderNumber)
      .single();

    const customerObj = Array.isArray(order?.customer) ? order.customer[0] : order?.customer;
    const custEmail = customerObj?.email;

    if (error || !order || custEmail?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Order not found. Please check your order number and email.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: order });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
