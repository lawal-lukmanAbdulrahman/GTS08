import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../../_lib/staff-access";
import { adjustInventory } from "../../pos/_lib/inventory";
import { movementReason } from "../../_lib/inventory-reasons";
import { withIdempotency } from "@/lib/idempotency";

const MAX_QUANTITY = 1_000_000;
const MAX_THRESHOLD = 100_000;
const ADJUSTMENTS = ["add", "remove", "set"] as const;
type Adjustment = (typeof ADJUSTMENTS)[number];

const isWholeNumber = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * Adjust one variant's stock (by variant id or inventory id), or its low-stock
 * threshold. Only staff with the inventory grant may. The count changes with a
 * compare-and-swap so a sale landing at the same moment can't be overwritten,
 * and every change to the count leaves a movement row naming who made it.
 */
export const PUT = withIdempotency(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePermission(request, "can_manage_inventory");
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Inventory record not found", code: "NOT_FOUND" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send a JSON object.", code: "INVALID_BODY" }, { status: 400 });
  }

  const { adjustment_type, quantity, reason, notes, low_stock_threshold } = body;
  const changingCount = adjustment_type !== undefined || quantity !== undefined;
  const errors: Record<string, string> = {};

  if (changingCount) {
    if (!ADJUSTMENTS.includes(adjustment_type as Adjustment)) errors.adjustment_type = "Choose add, remove or set.";
    const min = adjustment_type === "set" ? 0 : 1;
    if (!isWholeNumber(quantity, min, MAX_QUANTITY)) errors.quantity = `Enter a whole number from ${min} to ${MAX_QUANTITY}.`;
    if (typeof reason !== "string" || !reason.trim() || reason.length > 100) errors.reason = "Give a short reason for the change.";
  }
  if (low_stock_threshold !== undefined && !isWholeNumber(low_stock_threshold, 0, MAX_THRESHOLD)) {
    errors.low_stock_threshold = `Enter a whole number from 0 to ${MAX_THRESHOLD}.`;
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) errors.notes = "Keep notes to 500 characters or fewer.";
  if (!changingCount && low_stock_threshold === undefined && !errors.notes) errors.body = "Nothing to change.";

  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data: current } = await serviceClient
    .from("inventory")
    .select("id, variant_id, quantity, reserved_quantity, low_stock_threshold")
    .or(`variant_id.eq.${id},id.eq.${id}`)
    .maybeSingle();
  const row = current as { id: string; variant_id: string; quantity: number } | null;
  if (!row) return NextResponse.json({ error: "Inventory record not found", code: "NOT_FOUND" }, { status: 404 });

  let delta = 0;
  if (changingCount) {
    const q = quantity as number;
    if (adjustment_type === "add") delta = q;
    else if (adjustment_type === "remove") delta = -Math.min(q, row.quantity); // never below zero
    else delta = q - row.quantity;

    if (delta !== 0) {
      const applied = await adjustInventory(serviceClient, { variantId: row.variant_id, deltaQuantity: delta });
      if (!applied.ok) {
        return NextResponse.json(
          { error: "The stock count changed while you were editing it. Reload and try again.", code: "INVENTORY_CHANGED" },
          { status: 409 }
        );
      }
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (low_stock_threshold !== undefined) updates.low_stock_threshold = low_stock_threshold;
  if (delta > 0) updates.last_restocked_at = new Date().toISOString();

  const { data: updated, error: updateError } = await serviceClient
    .from("inventory")
    .update(updates)
    .eq("id", row.id)
    .select()
    .single();
  if (updateError) {
    console.error("[inventory/[id]] update failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save the change. Please try again.", code: "DATABASE_ERROR" }, { status: 500 });
  }

  if (delta !== 0) {
    const why = movementReason(reason as string, typeof notes === "string" ? notes : null);
    const { error: movementError } = await serviceClient.from("stock_movements").insert({
      variant_id: row.variant_id,
      delta,
      reason: why.reason,
      actor_id: access.user.id,
      notes: why.notes,
    });
    if (movementError) console.error("[inventory/[id]] movement insert failed:", movementError.message);
  }

  return NextResponse.json({ data: updated });
});
