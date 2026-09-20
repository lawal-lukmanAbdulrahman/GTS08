import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validatePasswordChange } from "@gts/utils";
import { requireStaff } from "../../../_lib/staff-access";
import { clientIp, logActivity } from "../../../_lib/activity";

/** Change your own password: current + new + confirm (employee spec Part 8). */
export async function POST(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const current = text(body.current_password);
  const next = text(body.new_password);
  const confirm = text(body.confirm_password);

  const check = validatePasswordChange({ current, next, confirm });
  if (!check.ok) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Prove they know the current password before changing it, so a borrowed
  // signed-in till can't be used to lock the owner out.
  const { data: signedIn, error: signInError } = await serviceClient.auth.signInWithPassword({
    email: staff.user.email ?? "",
    password: current,
  });
  if (signInError || !signedIn?.user) {
    // 400, not 401: a wrong password must not look like an expired session.
    return NextResponse.json(
      { error: "Your current password is incorrect.", code: "CURRENT_PASSWORD_INCORRECT", details: { current_password: "Your current password is incorrect." } },
      { status: 400 }
    );
  }

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(staff.user.id, { password: next });
  if (updateError) {
    return NextResponse.json({ error: "Couldn't update your password. Please try again.", code: "PASSWORD_UPDATE_FAILED" }, { status: 500 });
  }

  // They now hold a password of their own. (A database without the column yet just skips this.)
  const { error: clearError } = await serviceClient.from("users").update({ must_change_password: false }).eq("id", staff.user.id);
  if (clearError && !/must_change_password/.test(clearError.message ?? "")) {
    console.error("[staff/me/password] could not clear must_change_password:", clearError.message);
  }

  await logActivity(serviceClient, {
    actorId: staff.user.id,
    action: "profile.change_password",
    targetType: "user",
    targetId: staff.user.id,
    ip: clientIp(request),
  });

  return NextResponse.json({ data: { changed: true } });
}
