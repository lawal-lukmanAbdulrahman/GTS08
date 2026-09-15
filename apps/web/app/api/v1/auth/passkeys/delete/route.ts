import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { passkeyId } = await request.json();
    if (!passkeyId) {
      return NextResponse.json({ error: "Passkey ID is required." }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    await serviceClient
      .from("user_passkeys")
      .delete()
      .eq("id", passkeyId)
      .eq("user_id", user.id);

    // Also update metadata fallback
    const currentMetaKeys = (user.user_metadata?.passkeys as any[]) || [];
    const filtered = currentMetaKeys.filter((k) => k.id !== passkeyId && k.credential_id !== passkeyId);

    await supabase.auth.updateUser({
      data: {
        passkeys: filtered,
        has_passkeys: filtered.length > 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting passkey:", err);
    return NextResponse.json({ error: "Failed to delete passkey." }, { status: 500 });
  }
}
