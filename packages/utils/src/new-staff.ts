export const STAFF_ROLES = ["cashier", "inventory_staff", "admin"] as const;
export type NewStaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<NewStaffRole, string> = {
  cashier: "Cashier",
  inventory_staff: "Inventory staff",
  admin: "Admin",
};

export const PERMISSION_GRANTS = [
  "can_process_pos",
  "can_void_orders",
  "can_apply_discounts",
  "can_manage_inventory",
  "can_view_all_orders",
  "can_manage_products",
  "can_handle_tickets",
  "can_manage_broadcasts",
] as const;
export type PermissionGrant = (typeof PERMISSION_GRANTS)[number];

export interface NewStaffInput {
  email: string;
  full_name: string;
  role: NewStaffRole;
  permissions: Record<PermissionGrant, boolean>;
}

export type NewStaffValidation =
  | { ok: true; value: NewStaffInput }
  | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What each role starts with when the super admin doesn't pick grants. */
export function defaultGrants(role: NewStaffRole): Record<PermissionGrant, boolean> {
  const all = (on: boolean) => Object.fromEntries(PERMISSION_GRANTS.map((k) => [k, on])) as Record<PermissionGrant, boolean>;
  if (role === "admin") return all(true);
  const base = all(false);
  if (role === "cashier") base.can_process_pos = true;
  if (role === "inventory_staff") base.can_manage_inventory = true;
  return base;
}

/** A super admin adding a person. Shared by the form (instant feedback) and the API (the authority). */
export function validateNewStaff(input: unknown): NewStaffValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: { _body: "Expected a JSON object." } };
  }
  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) errors.email = "Enter their email address.";
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = "Enter a valid email address.";

  const fullName = typeof body.full_name === "string" ? body.full_name.replace(/\s+/g, " ").trim() : "";
  if (!fullName) errors.full_name = "Enter their full name.";
  else if (fullName.length > 100) errors.full_name = "Keep the name to 100 characters or fewer.";

  const role = body.role as NewStaffRole;
  if (!STAFF_ROLES.includes(role)) errors.role = "Choose cashier, inventory staff or admin.";

  const permissions = STAFF_ROLES.includes(role) ? defaultGrants(role) : defaultGrants("cashier");
  if (body.permissions !== undefined) {
    if (typeof body.permissions !== "object" || body.permissions === null) {
      errors.permissions = "Permissions must be an object.";
    } else if (role !== "admin") {
      for (const [key, value] of Object.entries(body.permissions as Record<string, unknown>)) {
        if (!(PERMISSION_GRANTS as readonly string[]).includes(key)) continue;
        if (typeof value !== "boolean") errors.permissions = `${key} must be true or false.`;
        else permissions[key as PermissionGrant] = value;
      }
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { email, full_name: fullName, role, permissions } };
}
