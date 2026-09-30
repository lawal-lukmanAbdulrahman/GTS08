import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";
import { verifyPassword } from "../../../_lib/verify-password";
import { dbError } from "../../../_lib/http";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change own account email address (Admin only).
 * Requires verifying current password before updating auth.users and public.users.
 */
export async function POST(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  if (!staff.isAdmin) {
    return NextResponse.json(
      { error: "Only administrators can change their account email address.", code: "PERMISSION_DENIED" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const newEmail = text(body.new_email).toLowerCase();
  const currentPassword = text(body.current_password);

  const errors: Record<string, string> = {};

  if (!newEmail) {
    errors.new_email = "Enter your new email address.";
  } else if (!EMAIL_REGEX.test(newEmail)) {
    errors.new_email = "Enter a valid email address.";
  } else if (newEmail === staff.user.email?.toLowerCase()) {
    errors.new_email = "New email must be different from your current email.";
  }

  if (!currentPassword) {
    errors.current_password = "Enter your current password to confirm this change.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors },
      { status: 400 }
    );
  }

  // Security check: verify current password
  const passwordValid = await verifyPassword(staff.user.email ?? "", currentPassword);
  if (!passwordValid) {
    return NextResponse.json(
      {
        error: "Your current password is incorrect.",
        code: "CURRENT_PASSWORD_INCORRECT",
        details: { current_password: "Your current password is incorrect." },
      },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Check if new email is already in use by another user
  const { data: existingUser, error: checkError } = await serviceClient
    .from("users")
    .select("id")
    .eq("email", newEmail)
    .maybeSingle();

  if (checkError) {
    return dbError(checkError, "DATABASE_ERROR", 500);
  }

  if (existingUser && existingUser.id !== staff.user.id) {
    return NextResponse.json(
      {
        error: "This email address is already in use by another account.",
        code: "EMAIL_IN_USE",
        details: { new_email: "This email address is already in use." },
      },
      { status: 409 }
    );
  }

  // Update Supabase Auth user
  const { error: authError } = await serviceClient.auth.admin.updateUserById(staff.user.id, {
    email: newEmail,
    email_confirm: true,
  });

  if (authError) {
    console.error("[staff/me/email] auth update error:", authError.message);
    return NextResponse.json(
      { error: "Could not update email in authentication service. Please try again.", code: "AUTH_UPDATE_FAILED" },
      { status: 500 }
    );
  }

  // Update public.users table
  const { error: updateDbError } = await serviceClient
    .from("users")
    .update({ email: newEmail, updated_at: new Date().toISOString() })
    .eq("id", staff.user.id);

  if (updateDbError) {
    console.error("[staff/me/email] db update error:", updateDbError.message);
    return dbError(updateDbError, "DATABASE_ERROR", 500);
  }

  // Log activity
  await logActivity(serviceClient, {
    actorId: staff.user.id,
    action: "profile.change_email",
    targetType: "user",
    targetId: staff.user.id,
    changes: { old_email: staff.user.email, new_email: newEmail },
    ip: clientIp(request),
  });

  return NextResponse.json({
    data: {
      email: newEmail,
      message: "Email address successfully updated.",
    },
  });
}
