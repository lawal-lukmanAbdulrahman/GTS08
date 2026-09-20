import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { validateStoreSettings } from "@gts/utils";
import { requireAdmin } from "../_lib/staff-access";

// The settings table is a one-row singleton (migration 00001).
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

// Public-safe columns only: these already appear on the storefront and on
// printed receipts. Tax rate, thresholds, etc. are deliberately not returned.
const STORE_COLUMNS = "store_name, store_address, support_phone, whatsapp_number, support_email";

const DEFAULT_STORE = {
  store_name: "GTS",
  store_address: null,
  support_phone: null,
  whatsapp_number: null,
  support_email: "hello@gts.ng",
};

export async function GET(_request: NextRequest) {
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("settings")
    .select(STORE_COLUMNS)
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? DEFAULT_STORE });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const serviceClient = createServiceClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const result = validateStoreSettings(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Some store details are invalid.", code: "VALIDATION_ERROR", details: result.errors },
      { status: 400 }
    );
  }

  const { data, error } = await serviceClient
    .from("settings")
    .upsert({ id: SETTINGS_ID, ...result.value, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select(STORE_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ data });
}
