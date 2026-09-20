import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../utils";
import { createServerClient } from "@gts/database";
import { generatePinTicket } from "@/../lib/pin-security";
import { withIdempotency } from "@/lib/idempotency";
import { serverError } from "../../../_lib/http";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required.", code: "INVALID_PASSWORD" }, { status: 400 });
    }

    // Verify password on the server via Supabase
    const supabase = await createServerClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Incorrect password. Please try again.", code: "INCORRECT_PASSWORD" },
        { status: 401 }
      );
    }

    // Password verified! Generate tamper-proof 5-minute ticket
    const ticket = generatePinTicket(user.id);

    return NextResponse.json({
      success: true,
      ticket,
      message: "Identity verified. You can now set your new PIN.",
    });
  } catch (err: any) {
    console.error("PIN reset with password error:", err);
    return serverError(err);
  }
});
