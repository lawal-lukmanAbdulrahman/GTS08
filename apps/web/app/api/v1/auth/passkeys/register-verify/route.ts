import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, createServiceClient } from "@gts/database/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get("gts_passkey_reg_challenge")?.value;

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Registration session expired. Please try again." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { id, rawId, clientDataJSON, attestationObject, deviceName } = body;

    if (!id || !clientDataJSON || !attestationObject) {
      return NextResponse.json(
        { error: "Incomplete credential data received." },
        { status: 400 }
      );
    }

    // Decode clientDataJSON to verify challenge and type
    const clientDataRaw = Buffer.from(clientDataJSON, "base64url").toString("utf-8");
    const clientData = JSON.parse(clientDataRaw);

    if (clientData.type !== "webauthn.create") {
      return NextResponse.json(
        { error: "Invalid WebAuthn operation type." },
        { status: 400 }
      );
    }

    if (clientData.challenge !== expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge verification failed. Possible replay attack." },
        { status: 400 }
      );
    }

    // Clean up registration challenge cookie
    cookieStore.delete("gts_passkey_reg_challenge");

    // Persist to user_passkeys table
    const serviceClient = createServiceClient();
    const credentialId = id || rawId;

    // Check if table exists, insert passkey
    const { data: inserted, error: insertError } = await serviceClient
      .from("user_passkeys")
      .insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: attestationObject,
        device_name: deviceName || "Passkey Device",
        counter: 0,
      })
      .select("id, credential_id, device_name, created_at, last_used_at")
      .single();

    if (insertError) {
      console.warn("DB insert to user_passkeys error, checking fallback:", insertError.message);
      // Fallback: store in user metadata if table not yet created
      const existingMetaKeys = (user.user_metadata?.passkeys as any[]) || [];
      const newKeyEntry = {
        id: credentialId,
        credential_id: credentialId,
        device_name: deviceName || "Passkey Device",
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      };
      await supabase.auth.updateUser({
        data: {
          passkeys: [...existingMetaKeys.filter((k) => k.credential_id !== credentialId), newKeyEntry],
          has_passkeys: true,
        },
      });

      return NextResponse.json({
        success: true,
        passkey: newKeyEntry,
      });
    }

    // Update user metadata flag
    await supabase.auth.updateUser({
      data: {
        has_passkeys: true,
      },
    });

    return NextResponse.json({
      success: true,
      passkey: inserted,
    });
  } catch (err: any) {
    console.error("Error in passkey registration verification:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify passkey registration." },
      { status: 500 }
    );
  }
}
