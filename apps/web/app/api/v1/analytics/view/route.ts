import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";
import { slugToUuidCache } from "../../_lib/storefront-cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/analytics/view
 * Public: log a product view or dwell engagement.
 * Body: { product_id: string, session_id?: string, duration_seconds?: number, scroll_depth?: number, event_type?: string }
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = null;
    const contentType = request.headers.get("content-type") || "";

    try {
      if (contentType.includes("application/json")) {
        body = await request.json();
      } else {
        const text = await request.text();
        body = text ? JSON.parse(text) : {};
      }
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
    }

    let { product_id, session_id, duration_seconds, scroll_depth, event_type } = body as {
      product_id?: string;
      session_id?: string;
      duration_seconds?: number;
      scroll_depth?: number;
      event_type?: string;
    };

    if (!product_id || typeof product_id !== "string") {
      return NextResponse.json({ success: false, error: "product_id is required." }, { status: 400 });
    }

    product_id = product_id.trim();
    const supabase = createServiceClient();
    // Resolve slug to UUID if needed
    if (!UUID_RE.test(product_id)) {
      const cachedId = slugToUuidCache.get(product_id);
      if (cachedId) {
        product_id = cachedId;
      } else {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("slug", product_id)
          .maybeSingle();

        if (!prod?.id) {
          return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
        }
        slugToUuidCache.set(product_id, prod.id);
        product_id = prod.id;
      }
    }

    const user = await getAuthenticatedUser(request);
    const validDuration = Math.max(0, Math.min(Math.round(Number(duration_seconds) || 0), 600));
    const validScrollDepth = Math.max(0, Math.min(Math.round(Number(scroll_depth) || 0), 100));
    const validEvent = typeof event_type === "string" ? event_type.toLowerCase() : "view";

    // Insert view record (non-blocking for the response)
    void Promise.resolve(
      supabase.from("product_views").insert({
        product_id,
        user_id: user?.id ?? null,
        session_id: typeof session_id === "string" ? session_id.trim().slice(0, 80) : null,
        duration_seconds: validDuration,
        scroll_depth: validScrollDepth,
        event_type: validEvent,
      })
    ).catch((err: unknown) => console.error("[api] product_views exception:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
