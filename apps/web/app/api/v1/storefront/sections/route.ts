import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { serverError, dbError } from "../../_lib/http";

import { getOrComputeCached, invalidateCache } from "../../_lib/storefront-cache";

/**
 * GET /api/v1/storefront/sections
 * Public: returns the ordered list of storefront sections from the DB.
 */
export async function GET() {
  try {
    const data = await getOrComputeCached(
      "storefront:sections:all",
      600, // 10 minutes
      async () => {
        const supabase = createServiceClient();
        const { data: rows, error } = await supabase
          .from("storefront_sections")
          .select("id, section_key, title, is_active, sort_order, config")
          .order("sort_order", { ascending: true });

        if (error) throw error;
        return rows ?? [];
      },
      1800
    );

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200" } }
    );
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/v1/storefront/sections
 * Admin-only: update section order, visibility, and config.
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const { sections } = body as { sections?: unknown };
    if (!Array.isArray(sections)) {
      return NextResponse.json({ success: false, error: "sections array is required." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert each section's config
    for (const s of sections) {
      const rec = s as Record<string, unknown>;
      if (!rec || typeof rec.section_key !== "string") continue;

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof rec.is_active === "boolean") update.is_active = rec.is_active;
      if (typeof rec.sort_order === "number") update.sort_order = rec.sort_order;
      if (typeof rec.title === "string") update.title = rec.title;
      if (rec.config !== undefined) update.config = rec.config;

      const { error } = await supabase
        .from("storefront_sections")
        .update(update)
        .eq("section_key", rec.section_key);

      if (error) return dbError(error);
    }

    invalidateCache("storefront:sections:all");

    // Return updated list
    const { data } = await supabase
      .from("storefront_sections")
      .select("id, section_key, title, is_active, sort_order, config")
      .order("sort_order", { ascending: true });

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return serverError(err);
  }
}
