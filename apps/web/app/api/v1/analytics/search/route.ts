import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";

/**
 * POST /api/v1/analytics/search
 * Public: log a search query. Fire-and-forget from the search page.
 * Body: { query: string, results_count?: number, session_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
    }

    const { query, results_count, session_id } = body as {
      query?: string;
      results_count?: number;
      session_id?: string;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ success: false, error: "query is required." }, { status: 400 });
    }

    // Don't store absurdly long queries
    const cleanQuery = query.trim().slice(0, 200);

    const supabase = createServiceClient();
    const user = await getAuthenticatedUser(request);

    const { error } = await supabase.from("search_queries").insert({
      user_id: user?.id ?? null,
      session_id: session_id ?? null,
      query: cleanQuery,
      results_count: typeof results_count === "number" ? results_count : 0,
    });

    if (error) {
      console.error("[api] search_queries insert error:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
