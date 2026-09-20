import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../_lib/http";

const SLOT_COLUMNS = "slot_key, headline, subheadline, cta_label, cta_link, image_cloudinary_id, mobile_image_cloudinary_id, start_date, end_date, updated_at";

/** Every live slot: active, and inside its start and end dates. Public; used by the homepage. */
export async function GET(_request: NextRequest) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await createServiceClient()
      .from("content_slots")
      .select(SLOT_COLUMNS)
      .eq("is_active", true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
  } catch (err) {
    return serverError(err);
  }
}
