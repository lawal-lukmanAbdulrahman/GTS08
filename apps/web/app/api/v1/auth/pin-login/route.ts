import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database";
import { consume, createRateLimitStore } from "@gts/utils";
import { hashPin } from "@/../lib/pin-security";
import { withIdempotency } from "@/lib/idempotency";
import { clientIp, logActivity } from "../../_lib/activity";
import { serverError } from "../../_lib/http";

const store = createRateLimitStore({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** A 6-digit PIN has a million possibilities, so guesses are held to a few per account, whichever address they come from. */
const PIN_ATTEMPTS = 5;
const PIN_WINDOW_MS = 15 * 60_000;

// One answer for every reason a PIN sign-in can fail, so the form can't be used to find out which addresses have accounts or PINs.
const REFUSED = { error: "Incorrect email or PIN. Try again or sign in with your password.", code: "UNAUTHORIZED" };

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** The customer's quick sign-in with a 6-digit PIN. Staff sign in with their password only. */
export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const pin = typeof body?.pin === "string" ? body.pin : "";

    if (!email || !pin) {
      return NextResponse.json({ error: "Email and PIN are required.", code: "INVALID_INPUT" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const attempt = await consume(store, [{ key: `rl:pin-account:${email}`, limit: PIN_ATTEMPTS, windowMs: PIN_WINDOW_MS, tier: "auth" }]);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "Too many PIN attempts for this account. Please wait a few minutes or sign in with your password.", code: "RATE_LIMIT_EXCEEDED", retryAfter: attempt.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
      );
    }

    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient.from("users").select("id, role, is_blocked").eq("email", email).maybeSingle();
    const account = profile as { id: string; role: string; is_blocked: boolean } | null;
    if (!account || account.is_blocked) return NextResponse.json(REFUSED, { status: 401 });

    if (account.role !== "customer") {
      await logActivity(serviceClient, { actorId: account.id, action: "auth.login_failed", targetType: "user", targetId: account.id, changes: { reason: "pin_not_allowed_for_staff" }, ip: clientIp(request) });
      return NextResponse.json(REFUSED, { status: 401 });
    }

    const { data: found } = await serviceClient.auth.admin.getUserById(account.id);
    const targetUser = found?.user;
    if (!targetUser) return NextResponse.json(REFUSED, { status: 401 });

    const storedHash = targetUser.user_metadata?.login_pin_hash as string | undefined;
    const storedPin = (targetUser.user_metadata?.login_pin || targetUser.user_metadata?.checkout_pin) as string | undefined;
    if (!storedHash && !storedPin) return NextResponse.json(REFUSED, { status: 401 });

    const inputHash = hashPin(pin);
    const isMatch = storedHash ? same(storedHash, inputHash) : same(String(storedPin), pin);
    if (!isMatch) return NextResponse.json(REFUSED, { status: 401 });

    // Auto-migrate a legacy plaintext PIN to a hash.
    if (!storedHash && storedPin) {
      await serviceClient.auth.admin.updateUserById(targetUser.id, {
        user_metadata: { ...targetUser.user_metadata, login_pin_hash: inputHash, has_pin: true, login_pin: null, checkout_pin: null },
      });
    }

    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({ type: "magiclink", email: targetUser.email ?? email });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("[auth/pin-login] could not create a session:", linkError?.message);
      return NextResponse.json({ error: "Could not sign you in. Please try again.", code: "SERVER_ERROR" }, { status: 500 });
    }

    const supabase = await createServerClient();
    await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });

    return NextResponse.json({
      success: true,
      user: { id: targetUser.id, email: targetUser.email, full_name: targetUser.user_metadata?.full_name || targetUser.email },
    });
  } catch (err: unknown) {
    return serverError(err);
  }
});
