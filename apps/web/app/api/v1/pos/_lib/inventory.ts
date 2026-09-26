/**
 * Atomic stock changes for the POS.
 *
 * Each write is a compare-and-swap: UPDATE ... WHERE quantity = <what we read>
 * AND reserved_quantity = <what we read>. Postgres row-locks the row, so when
 * two cashiers race for the last unit the loser's WHERE no longer matches,
 * the update touches zero rows, and we re-read and re-check. No RPC or
 * migration is required.
 */

import { invalidateStorefrontCaches } from "../../_lib/storefront-cache";

// The service client is untyped (createClient<any>) across this codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InventoryClient = { from(table: string): any };

export interface InventoryChange {
  variantId: string;
  deltaQuantity?: number;
  deltaReserved?: number;
  /** Minimum available (quantity - reserved) that must exist before applying. */
  requireAvailable?: number;
  /** Releasing more reservation than exists leaves it at zero instead of failing (online checkout doesn't reserve yet). */
  clampReserved?: boolean;
}

export type AdjustResult =
  | { ok: true }
  | { ok: false; reason: "INSUFFICIENT_STOCK"; available: number }
  | { ok: false; reason: "CONTENTION" }
  | { ok: false; reason: "DATABASE_ERROR"; message: string };

export type AdjustAllResult =
  | { ok: true }
  | ({ failedVariantId: string } & Exclude<AdjustResult, { ok: true }>);

const MAX_ATTEMPTS = 6;

export async function adjustInventory(
  client: InventoryClient,
  change: InventoryChange,
  maxAttempts = MAX_ATTEMPTS
): Promise<AdjustResult> {
  const deltaQuantity = change.deltaQuantity ?? 0;
  const deltaReserved = change.deltaReserved ?? 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: row, error: readError } = await client
      .from("inventory")
      .select("quantity, reserved_quantity")
      .eq("variant_id", change.variantId)
      .maybeSingle();

    if (readError) return { ok: false, reason: "DATABASE_ERROR", message: readError.message };

    const current = row as { quantity: number; reserved_quantity: number } | null;
    const available = current ? Math.max(0, current.quantity - current.reserved_quantity) : 0;

    if (!current) return { ok: false, reason: "INSUFFICIENT_STOCK", available: 0 };
    if (change.requireAvailable !== undefined && available < change.requireAvailable) {
      return { ok: false, reason: "INSUFFICIENT_STOCK", available };
    }

    const nextQuantity = current.quantity + deltaQuantity;
    const rawReserved = current.reserved_quantity + deltaReserved;
    const nextReserved = change.clampReserved ? Math.max(0, rawReserved) : rawReserved;
    if (nextQuantity < 0 || nextReserved < 0) {
      return { ok: false, reason: "INSUFFICIENT_STOCK", available };
    }

    const patch: Record<string, number | string> = { updated_at: new Date().toISOString() };
    if (deltaQuantity !== 0) patch.quantity = nextQuantity;
    if (nextReserved !== current.reserved_quantity) patch.reserved_quantity = nextReserved;
    if (deltaQuantity < 0) patch.last_sold_at = new Date().toISOString();

    const { data: updated, error: writeError } = await client
      .from("inventory")
      .update(patch)
      .eq("variant_id", change.variantId)
      .eq("quantity", current.quantity)
      .eq("reserved_quantity", current.reserved_quantity)
      .select("variant_id");

    if (writeError) return { ok: false, reason: "DATABASE_ERROR", message: writeError.message };
    if (Array.isArray(updated) && updated.length === 1) return { ok: true };
    // Zero rows: someone else changed the row between our read and write. Retry.
  }

  return { ok: false, reason: "CONTENTION" };
}

/**
 * Applies every change or none: if one fails, the ones already applied are
 * reversed before returning the failure.
 */
export async function adjustAll(
  client: InventoryClient,
  changes: InventoryChange[]
): Promise<AdjustAllResult> {
  const applied: InventoryChange[] = [];

  for (const change of changes) {
    const result = await adjustInventory(client, change);
    if (!result.ok) {
      await rollback(client, applied);
      return { ...result, failedVariantId: change.variantId };
    }
    applied.push(change);
  }

  if (applied.length > 0) {
    invalidateStorefrontCaches();
  }

  return { ok: true };
}

export async function rollback(client: InventoryClient, applied: InventoryChange[]): Promise<void> {
  for (const change of applied) {
    await adjustInventory(client, {
      variantId: change.variantId,
      deltaQuantity: -(change.deltaQuantity ?? 0),
      deltaReserved: -(change.deltaReserved ?? 0),
    });
  }
  if (applied.length > 0) {
    invalidateStorefrontCaches();
  }
}
