import { NextResponse } from "next/server";
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
    const channel = searchParams.get("channel");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 50);
    const offset = (page - 1) * limit;

    if (!isStaff) {
      // Customer view: only retrieve orders belonging to this user/customer
      const { data: customerRecords } = await serviceClient
        .from("customers")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`);

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
          items:order_items(*)
        `,
          { count: "exact" }
        )
        .in("customer_id", customerIds);

      if (status) custQuery = custQuery.eq("status", status);
      if (channel) custQuery = custQuery.eq("channel", channel);

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
        items:order_items(*)
      `,
        { count: "exact" }
      );

    if (status) {
      query = query.eq("status", status);
    }

    if (channel) {
      query = query.eq("channel", channel);
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
