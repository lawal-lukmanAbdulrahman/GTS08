import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { validateStoreSettings, SOCIAL_LINK_FIELDS } from "@gts/utils";
import { requireAdmin } from "../_lib/staff-access";
import { dbError } from "../_lib/http";

// The settings table is a one-row singleton (migration 00001).
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

// Public-safe columns only: these appear on the storefront, its footer, checkout and printed receipts.
// Tax rate, thresholds, etc. are deliberately not returned.
const BASE = ["store_name", "store_address", "support_phone", "whatsapp_number", "support_email"];
const WEBSITE = ["store_website"]; // migration 00014
const STOREFRONT = ["pickup_hold_hours", "footer_about", ...SOCIAL_LINK_FIELDS]; // migration 00026

/** Newest first: a database that hasn't had a migration yet still answers with what it has. */
const TIERS: Array<{ columns: string[]; missing: string[]; migration: string | null }> = [
  { columns: [...BASE, ...WEBSITE, ...STOREFRONT], missing: [], migration: null },
  { columns: [...BASE, ...WEBSITE], missing: STOREFRONT, migration: "00026" },
  { columns: BASE, missing: [...WEBSITE, ...STOREFRONT], migration: "00014" },
];

const DEFAULTS: Record<string, unknown> = {
  store_name: "GTS",
  store_address: null,
  support_phone: null,
  whatsapp_number: null,
  support_email: "hello@gts.ng",
  store_website: null,
  pickup_hold_hours: 48,
  footer_about: null,
  ...Object.fromEntries(SOCIAL_LINK_FIELDS.map((k) => [k, null])),
};

type Row = Record<string, unknown> | null;
type Result = { data: Row; error: { message?: string } | null };

/** The error names a column the database doesn't have yet. */
const missingColumn = (e: { message?: string } | null, names: string[]) =>
  !!e && /column|schema cache/i.test(e.message ?? "") && names.some((n) => (e.message ?? "").includes(n));

const withDefaults = (row: Row, missing: string[]) => (row ? { ...Object.fromEntries(missing.map((k) => [k, DEFAULTS[k]])), ...row } : row);

export async function GET(_request: NextRequest) {
  const serviceClient = createServiceClient();
  for (const tier of TIERS) {
    const r = await serviceClient.from("settings").select(tier.columns.join(", ")).eq("id", SETTINGS_ID).maybeSingle();
    const error = r.error as { message?: string } | null;
    // Any optional column missing means an older database: try the next, smaller set.
    if (TIERS.indexOf(tier) < TIERS.length - 1 && missingColumn(error, tier.columns.filter((c) => !BASE.includes(c)))) continue;
    if (error) return dbError(error, "DATABASE_ERROR", 500);
    const row = r.data as unknown as Row;
    return NextResponse.json({ data: row ? withDefaults(row, tier.missing) : DEFAULTS });
  }
  return NextResponse.json({ data: DEFAULTS });
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
    return NextResponse.json({ error: "Some store details are invalid.", code: "VALIDATION_ERROR", details: result.errors }, { status: 400 });
  }

  const write = async (values: Record<string, unknown>, columns: string[]): Promise<Result> => {
    const r = await serviceClient
      .from("settings")
      .upsert({ id: SETTINGS_ID, ...values, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select(columns.join(", "))
      .single();
    return { data: r.data as unknown as Row, error: r.error as { message?: string } | null };
  };

  let warning: string | undefined;
  const values = result.value as Record<string, unknown>;
  for (const tier of TIERS) {
    const toSave = Object.fromEntries(Object.entries(values).filter(([k]) => !tier.missing.includes(k)));
    const skipped = Object.keys(values).filter((k) => tier.missing.includes(k));
    if (skipped.length > 0 && tier.migration) {
      warning = `Some details couldn't be saved yet (${skipped.join(", ")}): the database needs migration ${tier.migration}. Everything else was saved.`;
    }
    const { data, error } = Object.keys(toSave).length > 0 ? await write(toSave, tier.columns) : { data: null as Row, error: null };
    // Any optional column missing means an older database: try the next, smaller set.
    if (TIERS.indexOf(tier) < TIERS.length - 1 && missingColumn(error, tier.columns.filter((c) => !BASE.includes(c)))) continue;
    if (error) return dbError(error, "DATABASE_ERROR", 500);
    return NextResponse.json({ data: withDefaults(data, tier.missing), ...(warning ? { warning } : {}) });
  }
  return NextResponse.json({ error: "Store details couldn't be saved.", code: "DATABASE_ERROR" }, { status: 500 });
}
