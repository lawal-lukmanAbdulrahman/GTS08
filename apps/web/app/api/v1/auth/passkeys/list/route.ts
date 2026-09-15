import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@gts/database/server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: passkeys, error: dbError } = await serviceClient
      .from("user_passkeys")
      .select("id, credential_id, device_name, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbError || !passkeys || passkeys.length === 0) {
      const fallbackPasskeys = (user.user_metadata?.passkeys as any[]) || [];
      return NextResponse.json({ passkeys: fallbackPasskeys });
    }

    return NextResponse.json({ passkeys });
  } catch (err: any) {
    console.error("Error listing passkeys:", err);
    return NextResponse.json({ passkeys: [] });
  }
}
