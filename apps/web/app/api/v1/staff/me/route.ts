import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validatePhoneNumber } from "@gts/utils";
import { requireStaff } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { dbError } from "../../_lib/http";

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
      avatar_cloudinary_id: staff.avatarId,
      role: staff.role,
      is_admin: staff.isAdmin,
      is_super_admin: staff.isSuperAdmin,
      must_change_password: staff.mustChangePassword,
      permissions: staff.permissions,
    },
  });
}

// A Cloudinary public id: letters, digits, dashes, underscores, dots and folders. Never a URL or script.
const CLOUDINARY_ID = /^[A-Za-z0-9_\-./]{1,255}$/;

/**
 * Staff may change their own phone number. An admin may also change their own
 * name and profile photo. Email and role are never changed here, and any other
 * field in the body is ignored, never written.
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
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Send a JSON object.", code: "INVALID_BODY" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  if ("phone" in body) {
    const phone = validatePhoneNumber(body.phone);
    if (!phone.ok) errors.phone = phone.error;
    else update.phone = phone.value;
  }
  if (staff.isAdmin && "full_name" in body) {
    const name = typeof body.full_name === "string" ? body.full_name.replace(/\s+/g, " ").trim() : null;
    if (!name) errors.full_name = "Enter your name.";
    else if (name.length > 100) errors.full_name = "Keep your name to 100 characters or fewer.";
    else update.full_name = name;
  }
  if (staff.isAdmin && "avatar_cloudinary_id" in body) {
    const id = body.avatar_cloudinary_id;
    if (id === null || id === "") update.avatar_cloudinary_id = null;
    else if (typeof id !== "string" || !CLOUDINARY_ID.test(id) || id.includes("..")) errors.avatar_cloudinary_id = "That photo couldn't be used. Upload it again.";
    else update.avatar_cloudinary_id = id;
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    const what = staff.isAdmin ? "your name, phone number or photo" : "a phone number (or blank to clear it)";
    return NextResponse.json({ error: `Nothing to update: send ${what}.`, code: "VALIDATION_ERROR", details: { phone: `Provide ${what}.` } }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const columns = ["phone", ...(staff.isAdmin ? ["full_name", "avatar_cloudinary_id"] : [])].join(", ");
  const { data, error } = await serviceClient
    .from("users")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", staff.user.id)
    .select(columns)
    .single();

  if (error) {
    return dbError(error, "DATABASE_ERROR", 500);
  }

  // Personal data: record which details changed, never what they changed to.
  const onlyPhone = Object.keys(update).length === 1 && "phone" in update;
  await logActivity(serviceClient, {
    actorId: staff.user.id,
    action: onlyPhone ? "profile.update_phone" : "profile.update",
    targetType: "user",
    targetId: staff.user.id,
    changes: onlyPhone ? { cleared: update.phone === null } : { fields: Object.keys(update) },
    ip: clientIp(request),
  });

  return NextResponse.json({ data });
}
