import type { NextRequest } from "next/server";
import type { InventoryClient } from "../pos/_lib/inventory";

/** Every staff write action that lands in activity_logs (employee spec Part 9.4). */
export type ActivityAction =
  | "auth.login"
  | "auth.logout"
  | "pos.sale"
  | "pos.void"
  | "pos.manual_discount"
  | "pos.whatsapp_create"
  | "pos.whatsapp_confirm"
  | "pos.whatsapp_cancel"
  | "pos.receipt_reprint"
  | "profile.update_phone"
  | "profile.change_password"
  | "staff.create"
  | "staff.permissions_update"
  | "product_flag.raise"
  | "product_flag.update"
  | "category.update"
  | "category.delete"
  | "category.reorder"
  | "order.update"
  | "order.status"
  | "promo.create"
  | "promo.update"
  | "promo.delete"
  | "ticket.update";

export interface ActivityEntry {
  actorId: string;
  action: ActivityAction;
  targetType: string;
  targetId?: string | null;
  changes?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Best-effort audit write. By the time this runs the sale/void/etc. has
 * already happened, so a logging failure must never turn it into an error for
 * the cashier; it is reported to the server log instead.
 */
export async function logActivity(client: InventoryClient, entry: ActivityEntry): Promise<void> {
  try {
    const { error } = await client.from("activity_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      changes: entry.changes ?? null,
      ip_address: entry.ip ? entry.ip.slice(0, 45) : null,
    });
    if (error) console.error("[activity_logs] insert failed:", error.message ?? error);
  } catch (err) {
    console.error("[activity_logs] insert threw:", err);
  }
}

export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || null;
  return request.headers.get("x-real-ip");
}
