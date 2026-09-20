import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { FLAG_STATUSES, type FlagStatus } from "@gts/utils";
import { requireAdmin } from "../_lib/staff-access";
import { dbError } from "../_lib/http";

/** The admin review queue of product flags raised by cashiers. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const status = new URL(request.url).searchParams.get("status") || "open";
  if (status !== "all" && !FLAG_STATUSES.includes(status as FlagStatus)) {
    return NextResponse.json({ error: "Unknown status filter.", code: "INVALID_STATUS" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  let query = serviceClient
    .from("product_flags")
    .select(
      // product_flags points at users twice (raised_by, resolved_by), so the embed must name its key.
      `id, reason, note, status, resolution_note, resolved_at, created_at,
       product:products(id, name),
       raiser:users!product_flags_raised_by_fkey(full_name, email)`
    );
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) return dbError(error, "DATABASE_ERROR", 500);

  const { data: all } = await serviceClient.from("product_flags").select("status").limit(5000);
  const counts: Record<FlagStatus, number> = { open: 0, in_review: 0, resolved: 0, dismissed: 0 };
  for (const row of (all || []) as Array<{ status: FlagStatus }>) {
    if (row.status in counts) counts[row.status] += 1;
  }

  return NextResponse.json({ data: { flags: data || [], counts } });
}
