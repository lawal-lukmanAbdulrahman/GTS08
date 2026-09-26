import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";
import { slugToUuidCache } from "../../_lib/storefront-cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_EVENTS = new Set([
  "view",
  "dwell",
  "read_details",
  "click",
  "wishlist_add",
  "cart_add",
  "share",
]);

/**
 * POST /api/v1/analytics/event
 * Public & Secure: Ingests high-level shopper engagement signals:
 * - Time spent looking (dwell duration)
 * - Reading details / specs (scroll depth & deep dwell)
 * - Clicks on product cards
 * - Saves / wishlists
 * - Cart additions
 *
 * Supports JSON or text/plain from navigator.sendBeacon.
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
      return NextResponse.json({ success: false, error: "Invalid payload format." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Missing body." }, { status: 400 });
    }

    let { product_id, session_id, event_type, duration_seconds, scroll_depth } = body;

    if (!product_id || typeof product_id !== "string") {
      return NextResponse.json({ success: false, error: "product_id is required." }, { status: 400 });
    }

    product_id = product_id.trim();

    const supabase = createServiceClient();

    // Resolve slug to UUID if slug was supplied instead of UUID
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

    // Sanitize event type
    const normalizedEvent = typeof event_type === "string" && ALLOWED_EVENTS.has(event_type.toLowerCase())
      ? event_type.toLowerCase()
      : "view";

    // Validate and clamp numbers
    const validDuration = Math.max(0, Math.min(Math.round(Number(duration_seconds) || 0), 600)); // cap at 10 mins
    const validScrollDepth = Math.max(0, Math.min(Math.round(Number(scroll_depth) || 0), 100)); // 0-100%

    // Clean session ID
    const cleanSessionId = typeof session_id === "string" ? session_id.trim().slice(0, 80) : null;

    // Detect authenticated user if available
    const user = await getAuthenticatedUser(request);

    // Non-blocking async insert for instant response
    void Promise.resolve(
      supabase.from("product_views").insert({
        product_id,
        user_id: user?.id ?? null,
        session_id: cleanSessionId,
        event_type: normalizedEvent,
        duration_seconds: validDuration,
        scroll_depth: validScrollDepth,
      })
    ).catch((err: unknown) => console.error("[analytics] async exception:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
