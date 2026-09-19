import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePosAccess } from "../_lib/access";

/** Top-level categories for the POS tabs; choosing one also covers its sub-categories (see products/search). */
export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (!access.ok) return access.response;

  const { data, error } = await createServiceClient()
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}
