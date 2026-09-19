import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { effectivePermissions } from "../../_lib/staff-access";

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
          .select("*") // includes the void/discount grants once migration 00010 is applied
          .eq("user_id", s.id)
          .single();

        return {
          ...s,
          permissions: effectivePermissions((perms as Record<string, unknown>) || null, s.role === "admin"),
        };
      })
    );

    return NextResponse.json({ data: staffWithPerms });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}
