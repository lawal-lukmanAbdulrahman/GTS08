import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import type { SalesRange } from "@gts/utils";
import { PERMISSION_KEYS, effectivePermissions, requireAdmin, requireSuperAdmin, type PermissionKey } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { afterResponse } from "../../_lib/email/after";
import { notifyAccessChanged } from "../../_lib/email/events";
import { loadActivity, loadSalesRecord, SALES_RANGES } from "../../_lib/staff-record";
import { dbError } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };

const STAFF_COLUMNS =
  "id, email, full_name, phone, role, is_blocked, is_demo, is_super_admin, removed_at, created_at, employee_permissions!employee_permissions_user_id_fkey(*)";

interface StaffRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_blocked: boolean;
  created_at: string;
  employee_permissions: Record<string, unknown> | Array<Record<string, unknown>> | null;
  is_demo?: boolean;
  is_super_admin?: boolean;
  removed_at?: string | null;
}

function permissionRow(row: StaffRow): Record<string, unknown> | null {
  return Array.isArray(row.employee_permissions) ? (row.employee_permissions[0] ?? null) : row.employee_permissions;
}

/** A staff member on the caller's side: the demo account and real staff never see each other's records. */
async function loadStaff(id: string, callerIsDemo: boolean): Promise<StaffRow | null> {
  const { data } = await createServiceClient().from("users").select(STAFF_COLUMNS).eq("id", id).maybeSingle();
  const row = data as unknown as StaffRow | null;
  // Removed staff are gone from every admin screen; their row stays only so history keeps their name.
  return row && row.role !== "customer" && !row.removed_at && (row.is_demo === true) === callerIsDemo ? row : null;
}

/** An admin's view of one staff member: profile and permissions, what they've sold, and what they've done. */
export async function GET(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Staff member not found.", code: "NOT_FOUND" }, { status: 404 });
  const range = (new URL(request.url).searchParams.get("range") || "today") as SalesRange;
  if (!SALES_RANGES.includes(range)) {
    return NextResponse.json({ error: "range must be today, week or month.", code: "INVALID_RANGE" }, { status: 400 });
  }

  const staff = await loadStaff(id, admin.isDemo === true);
  if (!staff) return NextResponse.json({ error: "Staff member not found.", code: "NOT_FOUND" }, { status: 404 });

  const serviceClient = createServiceClient();
  const [sales, activity] = await Promise.all([loadSalesRecord(serviceClient, id, range), loadActivity(serviceClient, id)]);
  if (!sales.ok) return dbError(sales, "DATABASE_ERROR", 500);
  if (!activity.ok) return dbError(activity, "DATABASE_ERROR", 500);

  const { ok: _ok, ...salesData } = sales;
  return NextResponse.json({
    data: {
      profile: {
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        phone: staff.phone,
        role: staff.role,
        is_blocked: staff.is_blocked,
        is_super_admin: staff.is_super_admin === true,
        created_at: staff.created_at,
        permissions: effectivePermissions(permissionRow(staff), staff.role === "admin"),
      },
      sales: salesData,
      activity: activity.data,
    },
  });
}

/**
 * Grant or revoke a staff member's permission flags, and block or unblock the
 * account. Nothing else about them can be changed here (not role, email or
 * name). Admins can't be blocked or edited through this: their access is
 * implicit, and an admin blocking themselves would lock everyone out.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Staff member not found.", code: "NOT_FOUND" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const sent = (typeof body.permissions === "object" && body.permissions !== null ? body.permissions : {}) as Record<string, unknown>;
  const flags: Partial<Record<PermissionKey, boolean>> = {};
  const errors: Record<string, string> = {};
  for (const key of PERMISSION_KEYS) {
    if (!(key in sent)) continue;
    if (typeof sent[key] === "boolean") flags[key] = sent[key] as boolean;
    else errors[key] = "Must be true or false.";
  }
  if (body.is_blocked !== undefined && typeof body.is_blocked !== "boolean") errors.is_blocked = "Must be true or false.";
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors }, { status: 400 });
  }
  const isBlocked = body.is_blocked as boolean | undefined;
  if (Object.keys(flags).length === 0 && isBlocked === undefined) {
    return NextResponse.json({ error: "Nothing to update.", code: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  const target = await loadStaff(id, admin.isDemo === true);
  if (!target) {
    // loadStaff hides customers as not-found; distinguish them for a clearer message.
    const { data } = await createServiceClient().from("users").select("role").eq("id", id).maybeSingle();
    if ((data as { role?: string } | null)?.role === "customer") {
      return NextResponse.json({ error: "That account isn't a staff account.", code: "NOT_STAFF" }, { status: 400 });
    }
    return NextResponse.json({ error: "Staff member not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  if (target.role === "admin") {
    if (id === admin.user.id && isBlocked === true) {
      return NextResponse.json({ error: "You can't block your own account.", code: "CANNOT_BLOCK_SELF" }, { status: 400 });
    }
    // An admin holds every permission, so only blocking applies, and only the super admin decides it.
    if (Object.keys(flags).length > 0 || isBlocked === undefined) {
      return NextResponse.json({ error: "Admin access can't be edited here.", code: "CANNOT_MODIFY_ADMIN" }, { status: 400 });
    }
    if (!admin.isSuperAdmin) {
      return NextResponse.json({ error: "Only the super admin can block or unblock another admin.", code: "SUPER_ADMIN_ONLY" }, { status: 403 });
    }
    if (target.is_super_admin) {
      return NextResponse.json({ error: "The super admin can't be blocked.", code: "CANNOT_BLOCK_SUPER_ADMIN" }, { status: 400 });
    }
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.from("users").update({ is_blocked: isBlocked, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return dbError(error, "DATABASE_ERROR", 500);
    if (isBlocked !== target.is_blocked) afterResponse(() => notifyAccessChanged(serviceClient, id, isBlocked));
    await logActivity(serviceClient, { actorId: admin.user.id, action: "staff.block", targetType: "user", targetId: id, changes: { blocked: isBlocked }, ip: clientIp(request) });
    return NextResponse.json({ data: { id, is_blocked: isBlocked, permissions: effectivePermissions(permissionRow(target), true) } });
  }

  const serviceClient = createServiceClient();
  const before = permissionRow(target) ?? {};
  let after: Record<string, unknown> = before;

  if (Object.keys(flags).length > 0) {
    const { data, error } = await serviceClient
      .from("employee_permissions")
      .upsert({ user_id: id, ...flags, granted_by: admin.user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) return dbError(error, "DATABASE_ERROR", 500);
    after = (data as Record<string, unknown>) ?? { ...before, ...flags };
  }

  if (isBlocked !== undefined) {
    const { error } = await serviceClient
      .from("users")
      .update({ is_blocked: isBlocked, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return dbError(error, "DATABASE_ERROR", 500);
    // Only tell them when their access actually changed, not on a repeat of the same state.
    if (isBlocked !== target.is_blocked) afterResponse(() => notifyAccessChanged(serviceClient, id, isBlocked));
  }

  const granted = (Object.keys(flags) as PermissionKey[]).filter((k) => flags[k] === true && before[k] !== true);
  const revoked = (Object.keys(flags) as PermissionKey[]).filter((k) => flags[k] === false && before[k] === true);
  await logActivity(serviceClient, {
    actorId: admin.user.id,
    action: "staff.permissions_update",
    targetType: "user",
    targetId: id,
    changes: { granted, revoked, ...(isBlocked === undefined ? {} : { is_blocked: isBlocked }) },
    ip: clientIp(request),
  });

  return NextResponse.json({
    data: {
      id,
      is_blocked: isBlocked ?? target.is_blocked,
      permissions: effectivePermissions(after, false),
    },
  });
}


/**
 * The super admin removes a staff member (another admin or anyone else). Their
 * login is disabled for good and they vanish from staff lists, but the account
 * row stays so the sales, voids and logs they made keep their name.
 */
export async function DELETE(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Staff member not found.", code: "NOT_FOUND" }, { status: 404 });
  if (id === admin.user.id) {
    return NextResponse.json({ error: "You can't remove your own account.", code: "CANNOT_REMOVE_SELF" }, { status: 400 });
  }

  const target = await loadStaff(id, admin.isDemo === true);
  if (!target) return NextResponse.json({ error: "Staff member not found.", code: "NOT_FOUND" }, { status: 404 });
  if (target.is_super_admin) {
    return NextResponse.json({ error: "The super admin can't be removed.", code: "CANNOT_REMOVE_SUPER_ADMIN" }, { status: 400 });
  }
  if (target.role === "admin" && !admin.isSuperAdmin) {
    return NextResponse.json({ error: "Only the super admin can remove another admin.", code: "SUPER_ADMIN_ONLY" }, { status: 403 });
  }

  const serviceClient = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await serviceClient.from("users").update({ is_blocked: true, removed_at: now, updated_at: now }).eq("id", id);
  if (error) return dbError(error, "DATABASE_ERROR", 500);

  // Refuse any future sign-in at the auth level too (about a hundred years).
  const { error: banError } = await serviceClient.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (banError) console.error("[users/remove] could not disable the login:", banError.message);

  await logActivity(serviceClient, { actorId: admin.user.id, action: "staff.remove", targetType: "user", targetId: id, changes: { role: target.role }, ip: clientIp(request) });
  return NextResponse.json({ data: { id, removed: true } });
}
