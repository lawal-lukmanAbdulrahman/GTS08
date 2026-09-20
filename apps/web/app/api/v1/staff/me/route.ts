import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validatePhoneNumber } from "@gts/utils";
import { requireStaff } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";

/** The signed-in staff member's own profile and what they're allowed to do. */
export async function GET(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  return NextResponse.json({
    data: {
      id: staff.user.id,
      email: staff.user.email,
      full_name: staff.fullName,
      phone: staff.phone,
      role: staff.role,
      is_admin: staff.isAdmin,
      is_super_admin: staff.isSuperAdmin,
      must_change_password: staff.mustChangePassword,
      permissions: staff.permissions,
    },
  });
}

/**
 * Staff may change their own phone number and nothing else: email, name and
 * role are admin-managed (employee spec Part 8), so any other field in the
 * body is ignored, never written.
 */
export async function PATCH(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("phone" in body)) {
    return NextResponse.json({ error: "A phone number is required.", code: "VALIDATION_ERROR", details: { phone: "Provide a phone number (or blank to clear it)." } }, { status: 400 });
  }

  const phone = validatePhoneNumber(body.phone);
  if (!phone.ok) {
    return NextResponse.json({ error: "That phone number isn't valid.", code: "VALIDATION_ERROR", details: { phone: phone.error } }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("users")
    .update({ phone: phone.value, updated_at: new Date().toISOString() })
    .eq("id", staff.user.id)
    .select("phone")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }

  // The number is personal data: record that it changed, not what it changed to.
  await logActivity(serviceClient, {
    actorId: staff.user.id,
    action: "profile.update_phone",
    targetType: "user",
    targetId: staff.user.id,
    changes: { cleared: phone.value === null },
    ip: clientIp(request),
  });

  return NextResponse.json({ data: { phone: (data as { phone: string | null }).phone } });
}
