import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createServerClient, createServiceClient } from "@gts/database/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required to register a passkey." }, { status: 401 });
    }

    // Determine RP ID based on hostname
    const hostHeader = request.headers.get("host") || "localhost";
    const rpId = hostHeader.split(":")[0];

    // Generate cryptographically secure random challenge
    const challenge = crypto.randomBytes(32).toString("base64url");

    // Fetch existing credentials to exclude
    const serviceClient = createServiceClient();
    const { data: existingPasskeys } = await serviceClient
      .from("user_passkeys")
      .select("credential_id")
      .eq("user_id", user.id);

    const excludeCredentials = (existingPasskeys || []).map((p: any) => ({
      id: p.credential_id,
      type: "public-key",
    }));

    // Save challenge in secure HTTP-only cookie (5 min expiry)
    const cookieStore = await cookies();
    cookieStore.set("gts_passkey_reg_challenge", challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    const userDisplayName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim() : "") ||
      user.email ||
      "GTS Member";

    return NextResponse.json({
      options: {
        challenge,
        rp: {
          name: "GTS Living Store",
          id: rpId,
        },
        user: {
          id: user.id,
          name: user.email || user.id,
          displayName: userDisplayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
          { alg: -8, type: "public-key" }, // Ed25519
        ],
        timeout: 60000,
        excludeCredentials,
      },
    });
  } catch (err: any) {
    console.error("Error generating passkey registration options:", err);
    return NextResponse.json({ error: "Internal server error initializing passkey." }, { status: 500 });
  }
}
