import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { isPlainObject } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

const MAX = 200;

/** Bulk reorder: body is a list of { id, sort_order }. */
export async function PUT(request: NextRequest) {
  const access = await requirePermission(request, "can_manage_products");
  if (!access.ok) return access.response;

  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const list = parsed.body;
    const bad = (message: string) => NextResponse.json({ error: message, code: "VALIDATION_ERROR" }, { status: 400 });
    if (!Array.isArray(list) || list.length === 0) return bad("Send a list of { id, sort_order }.");
    if (list.length > MAX) return bad(`You can reorder at most ${MAX} categories at once.`);
    const seen = new Set<string>();
    for (const row of list) {
      if (!isPlainObject(row) || !isUuid(row.id)) return bad("Every entry needs a category id.");
      if (typeof row.sort_order !== "number" || !Number.isInteger(row.sort_order) || row.sort_order < 0) return bad("Sort order must be a whole number, 0 or more.");
      if (seen.has(row.id)) return bad("A category appears twice.");
      seen.add(row.id);
    }

    const client = createServiceClient();
    const now = new Date().toISOString();
    for (const row of list as Array<{ id: string; sort_order: number }>) {
      const { error } = await client.from("categories").update({ sort_order: row.sort_order, updated_at: now }).eq("id", row.id);
      if (error) return serverError(new Error(error.message));
    }
    await logActivity(client, { actorId: access.user.id, action: "category.reorder", targetType: "category", changes: { count: list.length }, ip: clientIp(request) });
    return NextResponse.json({ data: { updated: list.length } });
  } catch (err) {
    return serverError(err);
  }
}
