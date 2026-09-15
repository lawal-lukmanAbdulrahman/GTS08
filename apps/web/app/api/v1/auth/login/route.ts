import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database";
import { sanitizeEmail } from "../utils";
import { validateSqlSafe } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const emailCheck = validateSqlSafe(body.email, "Email");
    if (!emailCheck.isSafe) {
      return NextResponse.json({ error: emailCheck.error, code: "INVALID_INPUT", field: "email" }, { status: 400 });
    }

    const email = sanitizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password.replace(/\0/g, "") : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error: !email ? "Please enter a valid staff email address." : "Please enter your account password.",
          code: "INVALID_INPUT",
          field: !email ? "email" : "password",
        },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format. Please enter a valid email address.", code: "INVALID_INPUT", field: "email" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: "Invalid email address or password. Please verify your credentials.",
          code: "UNAUTHORIZED",
          field: "password",
        },
        { status: 401 }
      );
    }

    // Fetch user profile
    const serviceClient = createServiceClient();
    const { data: userProfile, error: profileError } = await serviceClient
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile record not found. Please contact administrator.", code: "NOT_FOUND", field: "email" },
        { status: 404 }
      );
    }

    if (userProfile.is_blocked) {
      return NextResponse.json(
        { error: "This staff account is suspended. Please contact administrator.", code: "FORBIDDEN", field: "email" },
        { status: 403 }
      );
    }

    // Fetch employee permissions if staff
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
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
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
});
