import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: userProfile } = await serviceClient.from("users").select("role").eq("id", user.id).single();

    if (!userProfile || userProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    // Get all users who are not customer
    const { data: staffList, error } = await serviceClient
      .from("users")
      .select("id, email, full_name, role, is_blocked, created_at")
      .neq("role", "customer");

    if (error) {
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
    }

    // Attach permissions
    const staffWithPerms = await Promise.all(
      (staffList || []).map(async (s: any) => {
        const { data: perms } = await serviceClient
          .from("employee_permissions")
          .select("can_process_pos, can_manage_inventory, can_view_all_orders, can_manage_products, can_handle_tickets")
          .eq("user_id", s.id)
          .single();

        return {
          ...s,
          permissions: perms || {
            can_process_pos: false,
            can_manage_inventory: false,
            can_view_all_orders: false,
            can_manage_products: false,
            can_handle_tickets: false,
          },
        };
      })
    );

    return NextResponse.json({ data: staffWithPerms });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}
