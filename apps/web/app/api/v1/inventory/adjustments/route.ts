import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../_lib/staff-access";
import { MOVEMENT_REASONS } from "../../_lib/inventory-reasons";
import { isPlainObject } from "../../_lib/validate";
import { adjustAll, type InventoryChange } from "../../pos/_lib/inventory";
import { readJson, serverError } from "../../_lib/http";

const MAX_LINES = 50;
const MAX_QUANTITY = 1_000_000;
const TYPES = ["add", "remove", "set"] as const;

interface Line {
  variant_id: string;
  type: (typeof TYPES)[number];
  quantity: number;
  reason: (typeof MOVEMENT_REASONS)[number];
  notes: string | null;
}

/**
 * Several stock changes as one: all are applied or none. Removing never
 * touches stock that is reserved for an order, and every change leaves a
 * movement row naming who made it.
 */
export const POST = withIdempotency(async function POST(request: NextRequest) {
  const access = await requirePermission(request, "can_manage_inventory");
  if (!access.ok) return access.response;

  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const bad = (message: string, details?: Record<string, string>) => NextResponse.json({ error: message, code: "VALIDATION_ERROR", details }, { status: 400 });

    const list = isPlainObject(parsed.body) ? parsed.body.adjustments : undefined;
    if (!Array.isArray(list) || list.length === 0) return bad("Send a list of adjustments.");
    if (list.length > MAX_LINES) return bad(`At most ${MAX_LINES} adjustments at once.`);

    const lines: Line[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const n = i + 1;
      const l = list[i];
      if (!isPlainObject(l) || !isUuid(l.variant_id)) return bad(`Adjustment ${n} needs a product variant.`);
      if (!TYPES.includes(l.type as Line["type"])) return bad(`Adjustment ${n}: choose add, remove or set.`);
      const min = l.type === "set" ? 0 : 1;
      if (typeof l.quantity !== "number" || !Number.isInteger(l.quantity) || l.quantity < min || l.quantity > MAX_QUANTITY) return bad(`Adjustment ${n}: quantity must be a whole number from ${min} to ${MAX_QUANTITY}.`);
      if (!(MOVEMENT_REASONS as readonly string[]).includes(l.reason as string)) return bad(`Adjustment ${n}: choose a reason (${MOVEMENT_REASONS.join(", ")}).`);
      if (l.notes !== undefined && l.notes !== null && (typeof l.notes !== "string" || l.notes.length > 500)) return bad(`Adjustment ${n}: keep notes to 500 characters or fewer.`);
      if (seen.has(l.variant_id)) return bad(`Adjustment ${n}: a variant can only appear once.`);
      seen.add(l.variant_id);
      lines.push({ variant_id: l.variant_id, type: l.type as Line["type"], quantity: l.quantity, reason: l.reason as Line["reason"], notes: typeof l.notes === "string" && l.notes.trim() ? l.notes.trim() : null });
    }

    const client = createServiceClient();
    const { data, error } = await client.from("inventory").select("variant_id, quantity, reserved_quantity").in("variant_id", lines.map((l) => l.variant_id));
    if (error) return serverError(new Error(error.message));
    const stock = new Map(((data || []) as Array<{ variant_id: string; quantity: number }>).map((r) => [r.variant_id, r]));
    const missing = lines.find((l) => !stock.has(l.variant_id));
    if (missing) return NextResponse.json({ error: "One of those products has no stock record.", code: "NOT_FOUND", details: { variant_id: missing.variant_id } }, { status: 404 });

    const changes: InventoryChange[] = [];
    const movements: Array<Record<string, unknown>> = [];
    for (const l of lines) {
      const current = stock.get(l.variant_id)!.quantity;
      const delta = l.type === "add" ? l.quantity : l.type === "remove" ? -l.quantity : l.quantity - current;
      if (delta === 0) continue;
      changes.push(delta < 0 ? { variantId: l.variant_id, deltaQuantity: delta, requireAvailable: -delta } : { variantId: l.variant_id, deltaQuantity: delta });
      movements.push({ variant_id: l.variant_id, delta, reason: l.reason, actor_id: access.user.id, notes: l.notes });
    }

    if (changes.length > 0) {
      const applied = await adjustAll(client, changes);
      if (!applied.ok) {
        if (applied.reason === "INSUFFICIENT_STOCK") {
          return NextResponse.json({ error: "There isn't enough unreserved stock for that removal. Nothing was changed.", code: "INSUFFICIENT_STOCK", details: { variant_id: applied.failedVariantId, available: applied.available } }, { status: 409 });
        }
        if (applied.reason === "CONTENTION") {
          return NextResponse.json({ error: "The stock changed while you were editing it. Reload and try again.", code: "INVENTORY_CHANGED" }, { status: 409 });
        }
        return serverError(new Error(applied.message));
      }
      const { error: movementError } = await client.from("stock_movements").insert(movements);
      if (movementError) console.error("[inventory/adjustments] movement insert failed:", movementError.message);
    }

    return NextResponse.json({ data: { applied: changes.length, unchanged: lines.length - changes.length } });
  } catch (err) {
    return serverError(err);
  }
});
