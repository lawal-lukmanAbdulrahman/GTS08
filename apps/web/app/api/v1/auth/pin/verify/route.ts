import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../utils";
import { createServiceClient } from "@gts/database";
import { hashPin, generatePinTicket } from "@/../lib/pin-security";
import { withIdempotency } from "@/lib/idempotency";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== "string" || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits.", code: "INVALID_PIN" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: userData, error: userErr } = await serviceClient.auth.admin.getUserById(user.id);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "User account not found.", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    const meta = userData.user.user_metadata || {};
    const storedHash = meta.login_pin_hash;
    const legacyPlainPin = meta.login_pin || meta.checkout_pin;

    const inputHash = hashPin(pin);
    const isMatch = (storedHash && storedHash === inputHash) || (legacyPlainPin && legacyPlainPin === pin);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Incorrect PIN. Please check and try again.", code: "INCORRECT_PIN" },
        { status: 401 }
      );
    }

    // Auto-migrate legacy plaintext PIN to hash if not already migrated
    if (!storedHash && legacyPlainPin) {
      await serviceClient.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          login_pin_hash: inputHash,
          has_pin: true,
          login_pin: null,
          checkout_pin: null,
        },
      });
    }

    // Generate tamper-proof 5-minute ticket
    const ticket = generatePinTicket(user.id);

    return NextResponse.json({
      success: true,
      ticket,
      message: "PIN verified successfully.",
    });
  } catch (err: any) {
    console.error("PIN verify error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify PIN.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
});
