import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validatePromoInput } from "@gts/utils";
import { requireAdmin } from "../_lib/staff-access";
import { clientIp, logActivity } from "../_lib/activity";
import { PROMO_COLUMNS } from "../_lib/promo-db";
import { isDbUniqueViolation } from "../_lib/validate";
import { readJson, serverError } from "../_lib/http";

/** All promo codes with how much each has been used. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { data, error } = await createServiceClient().from("promos").select(PROMO_COLUMNS).order("created_at", { ascending: false }).limit(500);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validatePromoInput(parsed.body, "create");
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client.from("promos").insert(check.value).select(PROMO_COLUMNS).single();
    if (error) {
      if (isDbUniqueViolation(error)) return NextResponse.json({ error: "That code already exists.", code: "CODE_TAKEN", details: { code: "Already in use." } }, { status: 409 });
      return serverError(new Error(error.message));
    }
    await logActivity(client, { actorId: admin.user.id, action: "promo.create", targetType: "promo", targetId: (data as { id: string }).id, changes: { code: check.value.code }, ip: clientIp(request) });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
