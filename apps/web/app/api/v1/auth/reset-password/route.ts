import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@gts/database";
import { validateNewPassword } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { clientIp, logActivity } from "../../_lib/activity";
import { afterResponse } from "../../_lib/email/after";
import { notifyPasswordChanged } from "../../_lib/email/events";
import { serverError } from "../../_lib/http";
import { countResetSubmission } from "../../_lib/login-limit";

const INVALID_LINK = { error: "This reset link is invalid or has expired. Request a new one.", code: "INVALID_OR_EXPIRED_LINK" };

/** Chooses a new password with the single-use token from the reset email. Ends every existing session for the account. */
export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const next = typeof body?.new_password === "string" ? body.new_password : "";
    const confirm = typeof body?.confirm_password === "string" ? body.confirm_password : "";
    if (!token || token.length > 512) return NextResponse.json(INVALID_LINK, { status: 400 });

    const check = validateNewPassword(next, confirm);
    if (!check.ok) {
      return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });
    }

    const ip = clientIp(request);
    if (ip) {
      const attempt = await countResetSubmission(ip);
      if (!attempt.allowed) {
        return NextResponse.json({ error: "Too many attempts. Please wait a few minutes.", code: "RATE_LIMIT_EXCEEDED", retryAfter: attempt.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } });
      }
    }

    // A throwaway client: spending the token opens a session on it, which must not be the service client (see verify-password.ts).
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ token_hash: token, type: "recovery" });
    const user = verified?.user;
    if (verifyError || !user) return NextResponse.json(INVALID_LINK, { status: 400 });

    const client = createServiceClient();
    const { data: profile } = await client.from("users").select("id, role, is_blocked, full_name").eq("id", user.id).maybeSingle();
    const account = profile as { id: string; role: string; is_blocked: boolean; full_name: string | null } | null;
    if (!account || account.is_blocked) return NextResponse.json(INVALID_LINK, { status: 400 });

    // Whoever held the old password (or a stolen session) is signed out everywhere. This goes first: once the
    // password changes the link's own session is gone and can no longer be used to revoke the others.
    if (verified.session?.access_token) await client.auth.admin.signOut(verified.session.access_token, "global").catch(() => undefined);

    const { error: updateError } = await client.auth.admin.updateUserById(user.id, { password: next });
    if (updateError) {
      console.error("[auth/reset-password] could not set the password:", updateError.message);
      return NextResponse.json({ error: "Couldn't update your password. Please try again.", code: "PASSWORD_UPDATE_FAILED" }, { status: 500 });
    }

    const isStaff = account.role !== "customer";
    if (isStaff) {
      const { error: clearError } = await client.from("users").update({ must_change_password: false }).eq("id", user.id);
      if (clearError && !/must_change_password/.test(clearError.message ?? "")) console.error("[auth/reset-password] could not clear must_change_password:", clearError.message);
      await logActivity(client, { actorId: user.id, action: "auth.password_reset", targetType: "user", targetId: user.id, ip });
    }

    const email = user.email ?? null;
    afterResponse(() => notifyPasswordChanged(client, { name: account.full_name ?? "", email, account: isStaff ? "staff" : "customer" }));

    return NextResponse.json({ data: { reset: true } });
  } catch (err) {
    return serverError(err);
  }
});
