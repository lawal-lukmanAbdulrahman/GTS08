import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../_lib/staff-access";
import { noStore } from "../_lib/cart";
import { serverError } from "../_lib/http";

/** Recent admin notifications, newest first. Query: ?unread=true&limit=20 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const p = request.nextUrl.searchParams;
    const limit = p.has("limit") ? Number(p.get("limit")) : 20;
    const unreadFlag = p.get("unread");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (unreadFlag !== null && unreadFlag !== "true" && unreadFlag !== "false")) {
      return NextResponse.json({ error: "limit must be 1 to 100 and unread must be true or false.", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    let query = createServiceClient().from("admin_notifications").select("id, type, title, message, link, is_read, created_at").order("created_at", { ascending: false });
    if (unreadFlag === "true") query = query.eq("is_read", false);
    const { data, error } = await query.limit(limit);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: data ?? [] }, noStore);
  } catch (err) {
    return serverError(err);
  }
}
