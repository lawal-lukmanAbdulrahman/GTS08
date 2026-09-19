import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";

const STAFF_ROLES = ["admin", "cashier", "inventory_staff"];

export interface StaffPermissions {
  can_process_pos: boolean;
  can_manage_inventory: boolean;
  can_view_all_orders: boolean;
  can_manage_products: boolean;
  can_handle_tickets: boolean;
  can_void_orders: boolean;
  can_apply_discounts: boolean;
}

export type PermissionKey = keyof StaffPermissions;

export interface StaffContext {
  user: { id: string; email: string | null };
  role: string;
  isAdmin: boolean;
  fullName: string;
  phone: string | null;
  /** Effective permissions: an admin has every one implicitly. */
  permissions: StaffPermissions;
}

export type StaffResult = ({ ok: true } & StaffContext) | { ok: false; response: NextResponse };

export const PERMISSION_KEYS = [
  "can_process_pos",
  "can_manage_inventory",
  "can_view_all_orders",
  "can_manage_products",
  "can_handle_tickets",
  "can_void_orders",
  "can_apply_discounts",
] as const;

const NO_PERMISSIONS: StaffPermissions = {
  can_process_pos: false,
  can_manage_inventory: false,
  can_view_all_orders: false,
  can_manage_products: false,
  can_handle_tickets: false,
  can_void_orders: false,
  can_apply_discounts: false,
};

const PERMISSION_LABELS: Partial<Record<PermissionKey, string>> = {
  can_void_orders: "void sales",
  can_apply_discounts: "apply manual discounts",
};

function deny(status: number, error: string, code: string): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error, code }, { status }) };
}

export function effectivePermissions(row: Record<string, unknown> | null, isAdmin: boolean): StaffPermissions {
  const out = { ...NO_PERMISSIONS };
  for (const key of Object.keys(out) as PermissionKey[]) {
    // A column that doesn't exist yet (migration pending) reads as not granted.
    out[key] = isAdmin || row?.[key] === true;
  }
  return out;
}

/**
 * Signed in, a staff role, and not blocked. Every staff route builds on this.
 * The role/permissions are re-read from the database on every request (never
 * trusted from the token), and a blocked account is refused immediately so the
 * front end can sign it out (employee spec Part 9.5).
 */
export async function requireStaff(request: NextRequest): Promise<StaffResult> {
  const user = await getAuthenticatedUser(request);
  if (!user) return deny(401, "Unauthorized", "UNAUTHORIZED");

  const { data, error } = await createServiceClient()
    .from("users")
    .select("id, email, full_name, phone, role, is_blocked, employee_permissions!employee_permissions_user_id_fkey(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return deny(403, "Staff profile not found.", "FORBIDDEN");

  const row = data as unknown as {
    full_name?: string | null;
    phone?: string | null;
    role: string;
    is_blocked?: boolean;
    employee_permissions?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  };
  // A one-to-one embed comes back as an object; tolerate the array form too.
  const permissionRow = Array.isArray(row.employee_permissions)
    ? (row.employee_permissions[0] ?? null)
    : (row.employee_permissions ?? null);

  if (row.is_blocked) return deny(403, "Your account access has been suspended.", "ACCOUNT_BLOCKED");
  if (!STAFF_ROLES.includes(row.role)) return deny(403, "This area is for staff only.", "FORBIDDEN");

  const isAdmin = row.role === "admin";
  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    role: row.role,
    isAdmin,
    fullName: row.full_name ?? "",
    phone: row.phone ?? null,
    permissions: effectivePermissions(permissionRow, isAdmin),
  };
}

export async function requireAdmin(request: NextRequest): Promise<StaffResult> {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff;
  if (!staff.isAdmin) return deny(403, "Only admins can do this.", "FORBIDDEN");
  return staff;
}

/** Every /pos/* route: role + can_process_pos, re-verified server-side (cashier spec Part 1). */
export async function requirePosAccess(request: NextRequest): Promise<StaffResult> {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff;
  if (!staff.permissions.can_process_pos) {
    return deny(403, "You do not have POS access. Ask an admin to grant it.", "POS_ACCESS_DENIED");
  }
  return staff;
}

/** POS access plus one specific grant (e.g. voiding), for the sensitive actions. */
export async function requirePosPermission(request: NextRequest, key: PermissionKey): Promise<StaffResult> {
  const staff = await requirePosAccess(request);
  if (!staff.ok) return staff;
  if (!staff.permissions[key]) {
    const what = PERMISSION_LABELS[key] ?? "do this";
    return deny(403, `You don't have permission to ${what}. Ask an admin to grant it.`, "PERMISSION_DENIED");
  }
  return staff;
}
