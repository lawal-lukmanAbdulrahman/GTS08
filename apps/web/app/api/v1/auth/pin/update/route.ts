import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../utils";
import { createServiceClient } from "@gts/database";
import { hashPin, verifyPinTicket } from "@/../lib/pin-security";
import { withIdempotency } from "@/lib/idempotency";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const { newPin, ticket } = body;

    if (!newPin || typeof newPin !== "string" || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ error: "New PIN must be exactly 6 numeric digits.", code: "INVALID_PIN" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: userData, error: userErr } = await serviceClient.auth.admin.getUserById(user.id);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "User account not found.", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    const meta = userData.user.user_metadata || {};
    const hasExistingPin = Boolean(meta.login_pin_hash || meta.login_pin || meta.checkout_pin || meta.has_pin);

    // If an existing PIN exists, a valid server-issued ticket is strictly MANDATORY
    if (hasExistingPin) {
      if (!ticket || !verifyPinTicket(ticket, user.id)) {
        return NextResponse.json(
          { error: "Session expired or invalid authorization. Please authenticate your existing PIN first.", code: "INVALID_TICKET" },
          { status: 403 }
        );
      }
    }

    // Compute cryptographic hash of the new 6-digit PIN
    const hashedPin = hashPin(newPin);

    // Save hashed PIN and completely purge any legacy plaintext PINs
    const { error: updateErr } = await serviceClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        login_pin_hash: hashedPin,
        has_pin: true,
        login_pin: null,
        checkout_pin: null,
      },
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message, code: "DATABASE_ERROR" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "6-digit login PIN updated successfully and cryptographically secured.",
    });
  } catch (err: any) {
    console.error("PIN update error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update PIN.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
});
