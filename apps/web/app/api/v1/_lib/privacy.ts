import type { StaffContext } from "./staff-access";

/** Who may see what a product cost the store: admins and staff who manage products or stock. */
export function canSeeCost(staff: StaffContext | null): boolean {
  return !!staff && (staff.isAdmin || staff.permissions.can_manage_products || staff.permissions.can_manage_inventory);
}

/**
 * Removes every cost-related field from a value, at any depth. Public responses
 * pass through this so a cost column added later can't leak by accident
 * (security contract #7: cost_price never appears in a public response).
 */
export function stripCostFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripCostFields(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(cost|profit|margin)/i.test(k)) continue;
      out[k] = stripCostFields(v);
    }
    return out as T;
  }
  return value;
}
