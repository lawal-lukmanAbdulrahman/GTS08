import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../utils";
import { clientIp, logActivity } from "../../_lib/activity";

/**
 * Revokes the calling session and records the sign-out. Always answers 200:
 * signing out is idempotent, and if revoking fails the client still clears its
 * own session, so a till is never left signed in by an error here.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ data: { signed_out: true, revoked: false } });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const serviceClient = createServiceClient();

  let revoked = false;
  if (token) {
    try {
      const { error } = await serviceClient.auth.admin.signOut(token, "local");
      revoked = !error;
    } catch {
      revoked = false;
    }
  }

  await logActivity(serviceClient, {
    actorId: user.id,
    action: "auth.logout",
    targetType: "user",
    targetId: user.id,
    ip: clientIp(request),
  });

  return NextResponse.json({ data: { signed_out: true, revoked } });
}
