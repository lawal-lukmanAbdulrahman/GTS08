import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database";
import { hashPin } from "@/../lib/pin-security";
import { withIdempotency } from "@/lib/idempotency";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, pin } = body;

    if (!email || !pin) {
      return NextResponse.json({ error: "Email and PIN are required." }, { status: 400 });
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits." }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Look up user by email
    const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers();
    if (listError || !usersData?.users) {
      return NextResponse.json({ error: "Unable to verify user account." }, { status: 500 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const targetUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (!targetUser) {
      return NextResponse.json({ error: "No account found with this email." }, { status: 404 });
    }

    const storedHash = targetUser.user_metadata?.login_pin_hash;
    const storedPin = targetUser.user_metadata?.login_pin || targetUser.user_metadata?.checkout_pin;

    if (!storedHash && !storedPin) {
      return NextResponse.json(
        { error: "No login PIN has been set up for this account yet. Please sign in with your password to set one." },
        { status: 400 }
      );
    }

    const inputHash = hashPin(pin);
    const isMatch = (storedHash && storedHash === inputHash) || (storedPin && storedPin === pin);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Incorrect PIN. Please try again or sign in with your password." },
        { status: 401 }
      );
    }

    // Auto-migrate legacy plaintext PIN to cryptographic hash
    if (!storedHash && storedPin) {
      await serviceClient.auth.admin.updateUserById(targetUser.id, {
        user_metadata: {
          ...targetUser.user_metadata,
          login_pin_hash: inputHash,
          has_pin: true,
          login_pin: null,
          checkout_pin: null,
        },
      });
    }

    // PIN matched! Generate login session
    const supabase = await createServerClient();
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email!,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      return NextResponse.json({ error: "Could not create authenticated session." }, { status: 500 });
    }

    await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.user_metadata?.full_name || targetUser.email,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
});
