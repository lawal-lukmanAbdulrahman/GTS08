import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { validateNewStaff } from "@gts/utils";
import { effectivePermissions, requireSuperAdmin } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { generateTempPassword } from "../../_lib/temp-password";
import { requireAdmin } from "../../_lib/staff-access";

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if (!access.ok) return access.response;

    const serviceClient = createServiceClient();

    // Get all users who are not customer
    const { data: staffList, error } = await serviceClient
      .from("users")
      .select("id, email, full_name, role, is_blocked, created_at")
      .neq("role", "customer");

    if (error) {
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
    }

    // Attach permissions
    const staffWithPerms = await Promise.all(
      (staffList || []).map(async (s: any) => {
        const { data: perms } = await serviceClient
          .from("employee_permissions")
          .select("*") // includes the void/discount grants once migration 00010 is applied
          .eq("user_id", s.id)
          .single();

        return {
          ...s,
          permissions: effectivePermissions((perms as Record<string, unknown>) || null, s.role === "admin"),
        };
      })
    );

    return NextResponse.json({ data: staffWithPerms });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}


/**
 * The super admin adds a person: a confirmed login with a random one-time
 * password (shown once, never stored or logged), their profile, and their
 * permission grants. Anything that fails part-way is undone so no half-made
 * account is left able to sign in.
 */
export async function POST(request: NextRequest) {
  const superAdmin = await requireSuperAdmin(request);
  if (!superAdmin.ok) return superAdmin.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const check = validateNewStaff(body);
  if (!check.ok) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors },
      { status: 400 }
    );
  }
  const { email, full_name, role, permissions } = check.value;

  const serviceClient = createServiceClient();
  const password = generateTempPassword();

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createError || !created?.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    return NextResponse.json(
      taken
        ? { error: "Someone already has an account with that email.", code: "EMAIL_TAKEN", details: { email: "That email is already in use." } }
        : { error: createError?.message || "Could not create the account.", code: "CREATE_FAILED" },
      { status: taken ? 409 : 500 }
    );
  }
  const userId = created.user.id;

  const undo = async (alsoProfile: boolean) => {
    if (alsoProfile) await serviceClient.from("users").delete().eq("id", userId);
    await serviceClient.auth.admin.deleteUser(userId);
  };

  const { error: profileError } = await serviceClient.from("users").upsert({
    id: userId,
    email,
    full_name,
    role,
    is_blocked: false,
    email_verified_at: new Date().toISOString(),
  });
  if (profileError) {
    await undo(false);
    return NextResponse.json({ error: "Could not create the staff profile.", code: "CREATE_FAILED" }, { status: 500 });
  }

  // An admin's access is implicit, so they get no grants row.
  if (role !== "admin") {
    const { error: permError } = await serviceClient
      .from("employee_permissions")
      .upsert({ user_id: userId, ...permissions, granted_by: superAdmin.user.id }, { onConflict: "user_id" });
    if (permError) {
      await undo(true);
      return NextResponse.json({ error: "Could not save their permissions.", code: "CREATE_FAILED" }, { status: 500 });
    }
  }

  await logActivity(serviceClient, {
    actorId: superAdmin.user.id,
    action: "staff.create",
    targetType: "user",
    targetId: userId,
    changes: { email, role },
    ip: clientIp(request),
  });

  return NextResponse.json(
    { data: { id: userId, email, full_name, role, temporary_password: password } },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
