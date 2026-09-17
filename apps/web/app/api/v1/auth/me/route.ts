import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const serviceClient = createServiceClient();
    const { data: userProfile, error: profileError } = await serviceClient
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    let permissions = null;
    if (userProfile.role !== "customer") {
      const { data: permData } = await serviceClient
        .from("employee_permissions")
        .select("*")
        .eq("user_id", userProfile.id)
        .single();
      permissions = permData;
    }

    return NextResponse.json({
      data: {
        user: userProfile,
        permissions,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
