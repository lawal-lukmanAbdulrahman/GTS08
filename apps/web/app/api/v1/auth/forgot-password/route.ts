import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { withIdempotency } from "@/lib/idempotency";
import { sanitizeEmail } from "../utils";
import { afterResponse } from "../../_lib/email/after";
import { notifyPasswordReset } from "../../_lib/email/events";
import { serverError } from "../../_lib/http";
import { countResetRequest } from "../../_lib/login-limit";

const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const trimSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * "I forgot my password." Emails a single-use link to whoever owns the address.
 * The answer is the same whether or not an account exists, and the lookup and
 * the send happen after the response, so neither the words nor the timing
 * reveal which addresses are registered.
 */
export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = sanitizeEmail(typeof body?.email === "string" ? body.email : "");
    if (!email || !EMAIL.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address.", code: "INVALID_INPUT", field: "email" }, { status: 400 });
    }

    const attempt = await countResetRequest(email);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "Too many reset requests for this address. Please wait a few minutes and check your inbox.", code: "RATE_LIMIT_EXCEEDED", retryAfter: attempt.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
      );
    }

    const client = createServiceClient();
    afterResponse(async () => {
      try {
        const { data } = await client.from("users").select("id, role, is_blocked, full_name").eq("email", email).maybeSingle();
        const account = data as { id: string; role: string; is_blocked: boolean; full_name: string | null } | null;
        if (!account || account.is_blocked) return;

        const { data: link, error } = await client.auth.admin.generateLink({ type: "recovery", email });
        const token = link?.properties?.hashed_token;
        if (error || !token) {
          console.error("[auth/forgot-password] could not create a reset link:", error?.message);
          return;
        }
        const base = trimSlash(account.role === "customer" ? process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002" : process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001");
        await notifyPasswordReset(client, { name: account.full_name ?? "", email, resetUrl: `${base}/reset-password?token=${encodeURIComponent(token)}` });
      } catch (err) {
        console.error("[auth/forgot-password] failed:", err instanceof Error ? err.message : "unknown error");
      }
    });

    return NextResponse.json({ data: { sent: true } });
  } catch (err) {
    return serverError(err);
  }
});
