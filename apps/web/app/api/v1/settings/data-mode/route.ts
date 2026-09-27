import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "../../_lib/staff-access";

/**
 * Which data the signed-in admin is seeing: the demo account sees the demo data,
 * everyone else the live shop. There is no switch: it follows the account.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  return NextResponse.json({ data: { mode: admin.isDemo ? "test" : "live" } });
}
