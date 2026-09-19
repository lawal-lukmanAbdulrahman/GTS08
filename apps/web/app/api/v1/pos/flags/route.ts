import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validateProductFlag } from "@gts/utils";
import { requirePosAccess } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";

const FLAG_COLUMNS = "id, product_id, variant_id, reason, note, status, created_at";

/**
 * A cashier raises an issue on a product (wrong price, stock count off,
 * damaged, ...) for an admin to review. It is always raised in the caller's own
 * name; status and reviewer fields can't be supplied.
 */
export async function POST(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const check = validateProductFlag(body);
  if (!check.ok) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors },
      { status: 400 }
    );
  }
  const flag = check.value;

  const serviceClient = createServiceClient();

  const { data: product } = await serviceClient.from("products").select("id, name").eq("id", flag.product_id).maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "That product doesn't exist.", code: "PRODUCT_NOT_FOUND" }, { status: 404 });
  }

  if (flag.variant_id) {
    const { data: variant } = await serviceClient
      .from("product_variants")
      .select("id")
      .eq("id", flag.variant_id)
      .eq("product_id", flag.product_id)
      .maybeSingle();
    if (!variant) {
      return NextResponse.json(
        { error: "That variant isn't part of this product.", code: "VALIDATION_ERROR", details: { variant_id: "That variant isn't part of this product." } },
        { status: 400 }
      );
    }
  }

  const { data, error } = await serviceClient
    .from("product_flags")
    .insert({
      product_id: flag.product_id,
      variant_id: flag.variant_id,
      raised_by: access.user.id,
      reason: flag.reason,
      note: flag.note,
    })
    .select(FLAG_COLUMNS)
    .single();

  if (error) {
    // The unique index allows one live flag per person, product and reason.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "You've already flagged this for that reason and it hasn't been resolved yet.", code: "FLAG_ALREADY_OPEN" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  const created = data as { id: string };
  await logActivity(serviceClient, {
    actorId: access.user.id,
    action: "product_flag.raise",
    targetType: "product_flag",
    targetId: created.id,
    changes: { product_id: flag.product_id, reason: flag.reason },
    ip: clientIp(request),
  });

  return NextResponse.json({ data }, { status: 201 });
}

/** The caller's own flags, with any resolution note from the admin. */
export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { data, error } = await createServiceClient()
    .from("product_flags")
    .select("id, reason, note, status, resolution_note, resolved_at, created_at, product:products(name)")
    .eq("raised_by", access.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}
