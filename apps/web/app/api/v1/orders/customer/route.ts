import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryCustomerId = searchParams.get("customerId");
    const queryEmail = searchParams.get("email");
    const queryUserId = searchParams.get("userId");

    const authUser = await getAuthenticatedUser(request);
    const serviceClient = createServiceClient();

    // Collect all valid customer filters
    const customerFilters: string[] = [];

    if (authUser?.id) {
      customerFilters.push(`user_id.eq.${authUser.id}`);
    }
    if (authUser?.email) {
      customerFilters.push(`email.eq.${authUser.email.toLowerCase().trim()}`);
    }
    if (queryUserId) {
      customerFilters.push(`user_id.eq.${queryUserId}`);
    }
    if (queryEmail) {
      customerFilters.push(`email.eq.${queryEmail.toLowerCase().trim()}`);
    }
    if (queryCustomerId) {
      customerFilters.push(`id.eq.${queryCustomerId}`);
    }

    let customerIds: string[] = [];

    if (customerFilters.length > 0) {
      const { data: matchedCustomers } = await serviceClient
        .from("customers")
        .select("id")
        .or(customerFilters.join(","));

      if (matchedCustomers && matchedCustomers.length > 0) {
        customerIds = Array.from(new Set(matchedCustomers.map((c) => c.id)));
      }
    }

    // Direct match if queryCustomerId provided
    if (queryCustomerId && !customerIds.includes(queryCustomerId)) {
      customerIds.push(queryCustomerId);
    }

    if (customerIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch orders with order items and address, newest first
    const { data: orders, error } = await serviceClient
      .from("orders")
      .select("*, items:order_items(*), address:addresses(*)")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching customer orders:", error);
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: orders || [],
    });
  } catch (err: any) {
    console.error("Customer orders API error:", err);
    return serverError(err);
  }
}
