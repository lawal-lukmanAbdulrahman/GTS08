import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../utils";
import { withIdempotency } from "@/lib/idempotency";
import { validateSqlSafe } from "@gts/utils";
import {
  generateFourDigitOtp,
  normalizePhoneNumber,
  isValidNigerianPhone,
  sendPhoneVerificationCode,
} from "@/../lib/termii";
import { saveOtpForPhone } from "@/../lib/phone-otp-store";
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
    const { phone } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required", code: "MISSING_PHONE" },
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

    // Legit Nigerian mobile phone check
    if (!isValidNigerianPhone(phone)) {
      return NextResponse.json(
        {
          error: "Please enter a valid Nigerian mobile phone number (e.g. 080..., 081..., 090..., 091...).",
          code: "INVALID_NIGERIAN_PHONE",
        },
        { status: 400 }
      );
    }

    const normalized = normalizePhoneNumber(phone);

    // Ensure phone number is not the same as the user's current phone
    const currentPhone = user.phone || (user.user_metadata?.phone as string) || "";
    if (currentPhone) {
      const normalizedCurrent = normalizePhoneNumber(currentPhone);
      if (normalizedCurrent === normalized) {
        return NextResponse.json(
          {
            error: "New phone number cannot be the same as your current phone number.",
            code: "SAME_PHONE_NUMBER",
          },
          { status: 400 }
        );
      }
    }

    // Generate 4-digit code
    const code = generateFourDigitOtp();

    // Check rate limit and save in store
    const storeRes = saveOtpForPhone(user.id, normalized, code);
    if (!storeRes.success) {
      return NextResponse.json(
        {
          error: storeRes.error,
          retryAfterSeconds: storeRes.retryAfterSeconds,
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    // Send code via Termii SMS
    const smsRes = await sendPhoneVerificationCode(normalized, code);

    return NextResponse.json({
      success: true,
      message: `A 4-digit verification code has been sent to +${normalized}.`,
      normalizedPhone: normalized,
      // In development or if sender ID is pending on Termii, devCode allows instant testing
      devCode: smsRes.devCode,
    });
  } catch (err: any) {
    console.error("[PHONE SEND CODE ERROR]", err);
    return serverError(err);
  }
});
