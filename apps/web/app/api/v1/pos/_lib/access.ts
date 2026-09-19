import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";

const STAFF_ROLES = ["admin", "cashier", "inventory_staff"];

export interface PosAccessUser {
  id: string;
  email: string | null;
}

export type PosAccessResult =
  | { ok: true; user: PosAccessUser; role: string }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string, code: string): PosAccessResult {
  return { ok: false, response: NextResponse.json({ error, code }, { status }) };
}

/**
 * Every /pos/* Route Handler must call this. Role + can_process_pos are
 * re-verified server-side on every request — middleware alone is not
 * sufficient (gts_03_cashier_spec.md Part 1: "the most financially sensitive
 * portal").
 */
export async function requirePosAccess(request: NextRequest): Promise<PosAccessResult> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return deny(401, "Unauthorized", "UNAUTHORIZED");
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("users")
    // employee_permissions has two FKs to users (user_id, granted_by) so the
    // embed must be disambiguated or PostgREST rejects the query (PGRST201).
    .select("role, employee_permissions!employee_permissions_user_id_fkey(can_process_pos)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return deny(403, "Staff profile not found.", "FORBIDDEN");
  }

  const role = (data as { role: string }).role;
  const permissions = (data as { employee_permissions?: { can_process_pos?: boolean } })
    .employee_permissions;

  const canProcessPos = permissions?.can_process_pos === true;

  if (!STAFF_ROLES.includes(role) || !canProcessPos) {
    return deny(
      403,
      "You do not have POS access. Ask an admin to grant it.",
      "POS_ACCESS_DENIED"
    );
  }

  return { ok: true, user: { id: user.id, email: user.email ?? null }, role };
}
