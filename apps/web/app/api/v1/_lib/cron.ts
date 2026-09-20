import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Scheduled jobs are called by the scheduler with `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron does this automatically). With no secret configured they refuse to
 * run at all, so a missing setting can't leave them open to the internet.
 */
export function requireCron(request: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, response: NextResponse.json({ error: "Scheduled jobs are not configured.", code: "CRON_NOT_CONFIGURED" }, { status: 500 }) };
  }
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }) };
  }
  return { ok: true };
}
