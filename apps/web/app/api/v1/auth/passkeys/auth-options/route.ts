import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const hostHeader = request.headers.get("host") || "localhost";
    const rpId = hostHeader.split(":")[0];

    const challenge = crypto.randomBytes(32).toString("base64url");

    const cookieStore = await cookies();
    cookieStore.set("gts_passkey_auth_challenge", challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    return NextResponse.json({
      options: {
        challenge,
        rpId,
        timeout: 60000,
        userVerification: "preferred",
      },
    });
  } catch (err: any) {
    console.error("Error generating passkey auth options:", err);
    return NextResponse.json({ error: "Failed to initialize passkey sign in." }, { status: 500 });
  }
}
