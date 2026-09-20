import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { noStore } from "../../_lib/cart";
import { serverError } from "../../_lib/http";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { count, error } = await createServiceClient().from("admin_notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: { count: count ?? 0 } }, noStore);
  } catch (err) {
    return serverError(err);
  }
}
