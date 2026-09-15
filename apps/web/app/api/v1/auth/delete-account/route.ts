import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../utils";
import { createServerClient, createServiceClient } from "@gts/database";
import { withIdempotency } from "@/lib/idempotency";
import { validateSqlSafe, sanitizeSafeText } from "@gts/utils";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const { password, reason, notes } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required to confirm account deletion.", code: "INVALID_PASSWORD" },
        { status: 400 }
      );
    }

    // SQL Injection check on optional notes
    if (notes) {
      const notesCheck = validateSqlSafe(notes, "Notes");
      if (!notesCheck.isSafe) {
        return NextResponse.json({ error: notesCheck.error, code: "INVALID_INPUT" }, { status: 400 });
      }
    }

    // Verify password with Supabase server client
    const supabase = await createServerClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Incorrect password. Please verify your credentials.", code: "INCORRECT_PASSWORD" },
        { status: 401 }
      );
    }

    const serviceClient = createServiceClient();

    // Log deletion reason/feedback if table exists, non-blocking
    try {
      await serviceClient.from("customer_feedback").insert({
        customer_id: user.id,
        feedback_type: "account_deletion",
        reason: sanitizeSafeText(reason || "Rather not say", 100),
        notes: sanitizeSafeText(notes || "", 500),
      });
    } catch {
      // Non-blocking if table is optional
    }

    // Anonymize customer row
    try {
      await serviceClient
        .from("customers")
        .update({
          full_name: "[Deleted User]",
          phone: null,
        })
        .eq("id", user.id);
    } catch {
      // Non-blocking
    }

    // Permanently remove user from Supabase Auth
    const { error: deleteErr } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error("Failed to delete auth user:", deleteErr);
      return NextResponse.json(
        { error: "Failed to delete account. Please contact support.", code: "DELETION_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your GTS account has been permanently deleted.",
    });
  } catch (err: any) {
    console.error("Delete account error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
});
