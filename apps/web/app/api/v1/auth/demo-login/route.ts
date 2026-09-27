import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consume, createRateLimitStore } from "@gts/utils";
import { createServerClient, createServiceClient, runWithDataMode } from "@gts/database";
import { clientIp, logActivity } from "../../_lib/activity";
import { serverError } from "../../_lib/http";

const store = createRateLimitStore({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Offered only when DEMO_LOGIN_ENABLED=true: anyone who can reach the sign-in page can then open the demo. */
const enabled = () => process.env.DEMO_LOGIN_ENABLED?.trim().toLowerCase() === "true";

/** Whether the "Try the demo" buttons should show. */
export async function GET() {
  return NextResponse.json({ data: { enabled: enabled() } }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Signs straight into the demo account (users.is_demo), with no password. The
 * demo account only sees and changes demo data, can't touch store settings or
 * staff, and never sends email, so handing it out is safe. The session is set
 * as a cookie (storefront) and returned (dashboard), like a normal sign-in.
 */
export async function POST(request: NextRequest) {
  if (!enabled()) return NextResponse.json({ error: "The demo isn't available.", code: "NOT_FOUND" }, { status: 404 });

  const ip = clientIp(request) ?? "unknown";
  const attempt = await consume(store, [{ key: `rl:demo-login:${ip}`, limit: 10, windowMs: 60_000, tier: "auth" }]);
  if (!attempt.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute.", code: "RATE_LIMIT_EXCEEDED", retryAfter: attempt.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } });
  }

  try {
    const service = createServiceClient();
    const { data: row } = await service
      .from("users")
      .select("*")
      .eq("is_demo", true)
      .neq("role", "customer")
      .eq("is_blocked", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const demo = row as { id: string; email: string | null; role: string } | null;
    if (!demo?.email) {
      return NextResponse.json({ error: "The demo account hasn't been set up yet.", code: "DEMO_NOT_SET_UP" }, { status: 503 });
    }

    const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: "magiclink", email: demo.email });
    const hashed = link?.properties?.hashed_token;
    if (linkError || !hashed) throw new Error(`demo link: ${linkError?.message ?? "no token"}`);

    const supabase = await createServerClient();
    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
    const session = verified?.session;
    if (verifyError || !session) throw new Error(`demo session: ${verifyError?.message ?? "no session"}`);

    const { data: permissions } = await service.from("employee_permissions").select("*").eq("user_id", demo.id).maybeSingle();

    // Recorded in the demo account's own trail (this request has no caller yet, so pin the data set).
    await runWithDataMode("test", () =>
      logActivity(service, { actorId: demo.id, action: "auth.login", targetType: "user", targetId: demo.id, changes: { via: "demo_button" }, ip })
    );

    return NextResponse.json(
      { data: { session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at }, user: demo, permissions: permissions ?? null } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError(err);
  }
}
