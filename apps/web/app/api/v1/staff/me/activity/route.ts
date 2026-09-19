import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../../_lib/staff-access";
import { loadActivity } from "../../../_lib/staff-record";

/** The signed-in staff member's own recent actions, read-only (employee spec Part 8). */
export async function GET(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  const params = new URL(request.url).searchParams;
  const limit = parseInt(params.get("limit") || "30", 10);
  const page = await loadActivity(createServiceClient(), staff.user.id, {
    limit: Number.isNaN(limit) ? 30 : limit,
    before: params.get("before"),
  });
  if (!page.ok) return NextResponse.json({ error: page.message, code: "DATABASE_ERROR" }, { status: 500 });

  return NextResponse.json({ data: page.data });
}
