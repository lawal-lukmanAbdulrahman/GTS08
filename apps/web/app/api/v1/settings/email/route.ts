import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { consume, createRateLimitStore } from "@gts/utils";
import { requireAdmin } from "../../_lib/staff-access";
import { sendEmail } from "../../_lib/email/send";

const store = createRateLimitStore({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Is email set up, and from which address? Reports what is missing; never the key itself. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const missing = [!process.env.RESEND_API_KEY?.trim() && "RESEND_API_KEY", !process.env.EMAIL_FROM?.trim() && "EMAIL_FROM"].filter(Boolean) as string[];
  return NextResponse.json({ data: { configured: missing.length === 0, from: process.env.EMAIL_FROM?.trim() || null, missing } });
}

/** Sends a test message to the signed-in admin's own address, so the setup can be proved without emailing anyone else. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const to = admin.user.email;
  if (!to) return NextResponse.json({ error: "Your account has no email address to send the test to.", code: "NO_EMAIL" }, { status: 400 });

  const attempt = await consume(store, [{ key: `rl:email-test:${admin.user.id}`, limit: 3, windowMs: 10 * 60_000, tier: "auth" }]);
  if (!attempt.allowed) {
    return NextResponse.json({ error: "Too many test emails. Please wait a few minutes.", code: "RATE_LIMIT_EXCEEDED", retryAfter: attempt.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } });
  }

  let storeName = "GTS";
  try {
    const { data } = await createServiceClient().from("settings").select("store_name").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle();
    storeName = (data as { store_name?: string } | null)?.store_name || storeName;
  } catch {
    // The test still goes out with a plain name.
  }

  const message = {
    subject: `${storeName}: email is working`,
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">This is a test from the ${storeName} dashboard. If you can read it, order confirmations, receipts and password resets will reach your customers and staff.</p>`,
    text: `This is a test from the ${storeName} dashboard. If you can read it, order confirmations, receipts and password resets will reach your customers and staff.`,
  };
  const result = await sendEmail({ to, ...message });

  if (result.ok) return NextResponse.json({ data: { sent: true, to } });
  if (result.skipped) return NextResponse.json({ error: "Email isn't configured: set RESEND_API_KEY and EMAIL_FROM.", code: "EMAIL_NOT_CONFIGURED" }, { status: 409 });
  return NextResponse.json({ error: result.reason, code: "EMAIL_SEND_FAILED" }, { status: 502 });
}
