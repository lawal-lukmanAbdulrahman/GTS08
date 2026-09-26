import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database";
import { sanitizeEmail } from "../utils";
import { validateSqlSafe } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { clientIp, logActivity } from "../../_lib/activity";
import { serverError } from "../../_lib/http";
import { countLoginAttempt } from "../../_lib/login-limit";

/**
 * A wrong password against a real staff account is worth an audit entry (someone
 * guessing at the till). Unknown addresses and customers aren't logged: this
 * trail is staff actions, and an entry per typo would bury it. Best effort, and
 * it never changes the answer the caller gets.
 */
async function auditFailedStaffLogin(email: string, ip: string | null): Promise<void> {
  try {
    const client = createServiceClient();
    const { data } = await client.from("users").select("id, role").eq("email", email).maybeSingle();
    const account = data as { id: string; role: string } | null;
    if (!account || account.role === "customer") return;
    await logActivity(client, { actorId: account.id, action: "auth.login_failed", targetType: "user", targetId: account.id, changes: { reason: "wrong_password" }, ip });
  } catch {
    // The caller still gets the normal refusal.
  }
}

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Send the email and password as a JSON object.", code: "INVALID_BODY" }, { status: 400 });
    }

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

    // Stop guessing at one account, whichever address it comes from.
    const attempt = await countLoginAttempt(email);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "Too many sign-in attempts for this account. Please wait a minute and try again.", code: "RATE_LIMIT_EXCEEDED", retryAfter: attempt.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
      );
    }

    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      await auditFailedStaffLogin(email, clientIp(request));
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
      // The password was right, so a session now exists. End it: a suspended account must hold no valid session at all.
      await supabase.auth.signOut().catch(() => undefined);
      if (userProfile.role !== "customer") {
        await logActivity(serviceClient, { actorId: userProfile.id, action: "auth.login_blocked", targetType: "user", targetId: userProfile.id, ip: clientIp(request) });
      }
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

    // Staff sign-ins are audited (customers use this route too and aren't).
    if (userProfile.role !== "customer") {
      await logActivity(serviceClient, {
        actorId: userProfile.id,
        action: "auth.login",
        targetType: "user",
        targetId: userProfile.id,
        ip: clientIp(request),
      });
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
    return serverError(err);
  }
});
