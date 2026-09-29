import { NextResponse } from "next/server";
import { filterEmail } from "../_lib/filter";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { optionalStaff } from "../_lib/staff-access";
import { serverError, dbError } from "../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Everyone sees their own orders; only staff with the order grant see everyone's.
    const staff = await optionalStaff(request);
    const isStaff = !!staff && staff.permissions.can_view_all_orders;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");
    const queue = searchParams.get("queue");
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const channel = searchParams.get("channel");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);
    const offset = (page - 1) * limit;

    if (!isStaff) {
      // Customer view: only retrieve orders belonging to this user/customer
      const { data: customerRecords } = await serviceClient
        .from("customers")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${filterEmail(user.email ?? "")}`);

      const customerIds = customerRecords?.map((c) => c.id) || [];
      if (customerIds.length === 0) {
        return NextResponse.json({
          data: [],
          meta: { total: 0, page: 1, limit, pages: 1 },
        });
      }

      let custQuery = serviceClient
        .from("orders")
        .select(
          `
          *,
          customer:customers(*),
          items:order_items(*),
          pickup_station:pickup_stations(*)
        `,
          { count: "exact" }
        )
        .in("customer_id", customerIds);

      if (status && status !== "all") custQuery = custQuery.eq("status", status);
      if (paymentStatus && paymentStatus !== "all") custQuery = custQuery.eq("payment_status", paymentStatus);
      if (channel && channel !== "all") custQuery = custQuery.eq("channel", channel);
      if (search) custQuery = custQuery.ilike("order_number", `%${search}%`);

      custQuery = custQuery.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      const { data: orders, count, error } = await custQuery;

      if (error) {
        return dbError(error, "DATABASE_ERROR", 500);
      }

      const total = count || 0;
      const pages = Math.ceil(total / limit) || 1;
      return NextResponse.json({
        data: orders || [],
        meta: { total, page, limit, pages },
      });
    }

    let query = serviceClient
      .from("orders")
      .select(
        `
        *,
        customer:customers(*),
        items:order_items(*),
        pickup_station:pickup_stations(*)
      `,
        { count: "exact" }
      );

    if (queue === "ready_unpaid") {
      query = query.eq("status", "ready_for_pickup").eq("payment_status", "unpaid");
    } else {
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (paymentStatus && paymentStatus !== "all") {
        query = query.eq("payment_status", paymentStatus);
      }
    }

    if (channel && channel !== "all") {
      query = query.eq("channel", channel);
    }

    if (search) {
      query = query.ilike("order_number", `%${search}%`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: orders, count, error } = await query;

    if (error) {
      return dbError(error, "DATABASE_ERROR", 500);
    }

    const total = count || 0;
    const pages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      data: orders || [],
      meta: {
        total,
        page,
        limit,
        pages,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
