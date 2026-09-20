import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, createServiceClient } from "@gts/database/server";
import { serverError } from "../../../_lib/http";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get("gts_passkey_auth_challenge")?.value;

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Passkey sign-in session expired. Please try again." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { id, rawId, clientDataJSON, authenticatorData, signature } = body;

    if (!id || !clientDataJSON || !authenticatorData || !signature) {
      return NextResponse.json(
        { error: "Incomplete passkey assertion payload." },
        { status: 400 }
      );
    }

    // Verify clientDataJSON
    const clientDataRaw = Buffer.from(clientDataJSON, "base64url").toString("utf-8");
    const clientData = JSON.parse(clientDataRaw);

    if (clientData.type !== "webauthn.get") {
      return NextResponse.json(
        { error: "Invalid WebAuthn assertion type." },
        { status: 400 }
      );
    }

    if (clientData.challenge !== expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge verification mismatch." },
        { status: 400 }
      );
    }

    // Clear challenge cookie
    cookieStore.delete("gts_passkey_auth_challenge");

    const credentialId = id || rawId;
    const serviceClient = createServiceClient();

    // 1. Look up passkey in user_passkeys table
    let userId: string | null = null;
    const { data: passkeyRecord } = await serviceClient
      .from("user_passkeys")
      .select("id, user_id, device_name, counter")
      .eq("credential_id", credentialId)
      .maybeSingle();

    if (passkeyRecord?.user_id) {
      userId = passkeyRecord.user_id;
      // Update last_used_at timestamp
      await serviceClient
        .from("user_passkeys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", passkeyRecord.id);
    } else {
      // Fallback check in auth users metadata
      const { data: usersData } = await serviceClient.auth.admin.listUsers();
      if (usersData?.users) {
        for (const u of usersData.users) {
          const passkeys = (u.user_metadata?.passkeys as any[]) || [];
          if (passkeys.some((k) => k.credential_id === credentialId || k.id === credentialId)) {
            userId = u.id;
            break;
          }
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "No user found associated with this passkey credential." },
        { status: 404 }
      );
    }

    // Retrieve user details
    const { data: userData, error: getUserError } = await serviceClient.auth.admin.getUserById(userId);
    if (getUserError || !userData?.user) {
      return NextResponse.json({ error: "User account could not be retrieved." }, { status: 404 });
    }

    const user = userData.user;

    // Generate sign-in session for the user
    // We create a server client to establish the authenticated session cookies
    const supabase = await createServerClient();
    
    // Create an authenticated session link
    if (user.email) {
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });

      if (!linkError && linkData?.properties?.hashed_token) {
        await supabase.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: "magiclink",
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
      },
    });
  } catch (err: any) {
    console.error("Passkey auth verify error:", err);
    return serverError(err);
  }
}
