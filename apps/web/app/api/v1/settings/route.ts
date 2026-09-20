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
// Added by migration 00014; until it is applied the app keeps working without it.
const STORE_COLUMNS_WITH_WEBSITE = `${STORE_COLUMNS}, store_website`;
type Row = Record<string, unknown> | null;
const missingWebsiteColumn = (e: { message?: string } | null) => !!e && /store_website/.test(e.message ?? "");

const DEFAULT_STORE = {
  store_name: "GTS",
  store_address: null,
  support_phone: null,
  whatsapp_number: null,
  support_email: "hello@gts.ng",
  store_website: null,
};

export async function GET(_request: NextRequest) {
  const serviceClient = createServiceClient();
  const read = async (columns: string) => {
    const r = await serviceClient.from("settings").select(columns).eq("id", SETTINGS_ID).maybeSingle();
    return { data: r.data as unknown as Row, error: r.error as { message?: string } | null };
  };

  let { data, error } = await read(STORE_COLUMNS_WITH_WEBSITE);
  if (missingWebsiteColumn(error)) {
    ({ data, error } = await read(STORE_COLUMNS));
    if (data) data = { ...data, store_website: null };
  }

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

  const write = async (values: object, columns: string) => {
    const r = await serviceClient
      .from("settings")
      .upsert({ id: SETTINGS_ID, ...values, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select(columns)
      .single();
    return { data: r.data as unknown as Row, error: r.error as { message?: string } | null };
  };

  let warning: string | undefined;
  let { data, error } = await write(result.value, STORE_COLUMNS_WITH_WEBSITE);
  if (missingWebsiteColumn(error)) {
    // Migration 00014 isn't applied yet: save everything else rather than fail the whole form.
    const { store_website: _dropped, ...rest } = result.value;
    warning = "The website couldn't be saved yet: the database needs migration 00014. Everything else was saved.";
    ({ data, error } = Object.keys(rest).length > 0 ? await write(rest, STORE_COLUMNS) : { data: null as Row, error: null });
    if (data) data = { ...data, store_website: null };
  }

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ data, ...(warning ? { warning } : {}) });
}
