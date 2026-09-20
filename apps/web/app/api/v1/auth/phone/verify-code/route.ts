import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../utils";
import { withIdempotency } from "@/lib/idempotency";
import { validateSqlSafe } from "@gts/utils";
import { normalizePhoneNumber } from "@/../lib/termii";
import { verifyOtpForPhone } from "@/../lib/phone-otp-store";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../../_lib/http";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone, code } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required", code: "MISSING_PHONE" },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string" || code.trim().length !== 4) {
      return NextResponse.json(
        { error: "Please enter the 4-digit verification code", code: "INVALID_CODE_FORMAT" },
        { status: 400 }
      );
    }

    // SQL Injection guard
    const sqlCheck = validateSqlSafe(phone, "Phone number");
    if (!sqlCheck.isSafe) {
      return NextResponse.json(
        { error: sqlCheck.error, code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const normalized = normalizePhoneNumber(phone);
    const cleanPhoneWithPlus = `+${normalized}`;

    // Verify 4-digit OTP
    const verifyRes = verifyOtpForPhone(user.id, normalized, code.trim());
    if (!verifyRes.success) {
      return NextResponse.json(
        {
          error: verifyRes.error,
          locked: verifyRes.locked,
          code: verifyRes.locked ? "CODE_LOCKED" : "INVALID_CODE",
        },
        { status: 400 }
      );
    }

    // Verification succeeded: Update user in Supabase
    const serviceClient = createServiceClient();

    // 1. Update Supabase Auth user metadata
    try {
      await serviceClient.auth.admin.updateUserById(user.id, {
        phone: cleanPhoneWithPlus,
        user_metadata: {
          phone: cleanPhoneWithPlus,
          phone_verified: true,
        },
      });
    } catch (authErr) {
      console.warn("[PHONE VERIFY AUTH UPDATE WARNING]", authErr);
    }

    // 2. Update customers database table
    try {
      await serviceClient
        .from("customers")
        .update({
          phone: cleanPhoneWithPlus,
        })
        .eq("id", user.id);
    } catch (dbErr) {
      console.error("[PHONE VERIFY DB ERROR]", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: "Phone number verified and updated successfully!",
      phone: cleanPhoneWithPlus,
    });
  } catch (err: any) {
    console.error("[PHONE VERIFY ERROR]", err);
    return serverError(err);
  }
});
