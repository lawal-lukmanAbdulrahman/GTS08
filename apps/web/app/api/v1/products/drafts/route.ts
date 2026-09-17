import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { withIdempotency } from "@/lib/idempotency";

// ── GET /api/v1/products/drafts ──────────────────────────────────────────────
// Fetch all drafts or a specific draft by product_id or draft id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const draftId = searchParams.get("id");

    const serviceClient = createServiceClient();

    // If product_id specified, get working draft revision for this product
    if (productId) {
      const { data, error } = await serviceClient
        .from("product_drafts")
        .select("*, product:products(id, name, slug, status, base_price, primary_image:product_images(cloudinary_public_id))")
        .eq("product_id", productId)
        .order("updated_at", { ascending: false })
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
      }
      return NextResponse.json({ data: data || null });
    }

    // If draft id specified
    if (draftId) {
      const { data, error } = await serviceClient
        .from("product_drafts")
        .select("*, product:products(id, name, slug, status, base_price)")
        .eq("id", draftId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
      }
      return NextResponse.json({ data: data || null });
    }

    // Otherwise list all drafts
    const { data: drafts, error } = await serviceClient
      .from("product_drafts")
      .select("*, product:products(id, name, slug, status, base_price, category:categories(name))")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ data: drafts || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}

// ── POST /api/v1/products/drafts ─────────────────────────────────────────────
// Create or update a draft (upsert by id or product_id)
export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: userProfile } = await serviceClient.from("users").select("role").eq("id", user.id).single();

    if (!userProfile || !["admin", "inventory_staff"].includes(userProfile.role)) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const body = await request.json();
    const { id: draftId, product_id, title, draft_type = "new", draft_data } = body;

    if (!draft_data || typeof draft_data !== "object") {
      return NextResponse.json({ error: "draft_data is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const cleanTitle = (title || draft_data.name || "Untitled Draft").toString().slice(0, 255);
    const cleanDraftType = draft_type === "revision" ? "revision" : "new";

    // 1. If draftId is provided, update that specific draft
    if (draftId) {
      const { data: updated, error: updateErr } = await serviceClient
        .from("product_drafts")
        .update({
          title: cleanTitle,
          draft_data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .select()
        .single();

      if (!updateErr && updated) {
        return NextResponse.json({ data: updated });
      }
    }

    // 2. If product_id is provided for a revision, check if revision already exists and update it
    if (product_id) {
      const { data: existingRevision } = await serviceClient
        .from("product_drafts")
        .select("id")
        .eq("product_id", product_id)
        .maybeSingle();

      if (existingRevision) {
        const { data: updated, error: updateErr } = await serviceClient
          .from("product_drafts")
          .update({
            title: cleanTitle,
            draft_data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRevision.id)
          .select()
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message, code: "DATABASE_ERROR" }, { status: 400 });
        }
        return NextResponse.json({ data: updated });
      }
    }

    // 3. Insert new draft row
    const { data: newDraft, error: insertErr } = await serviceClient
      .from("product_drafts")
      .insert({
        product_id: product_id || null,
        title: cleanTitle,
        draft_type: cleanDraftType,
        draft_data,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message, code: "DATABASE_ERROR" }, { status: 400 });
    }

    return NextResponse.json({ data: newDraft }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});

// ── DELETE /api/v1/products/drafts ───────────────────────────────────────────
// Delete ONLY the draft row (leaves live product untouched!)
export const DELETE = withIdempotency(async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: userProfile } = await serviceClient.from("users").select("role").eq("id", user.id).single();

    if (!userProfile || !["admin", "inventory_staff"].includes(userProfile.role)) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("id");
    const productId = searchParams.get("product_id");

    if (!draftId && !productId) {
      return NextResponse.json({ error: "Draft ID or Product ID is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    let query = serviceClient.from("product_drafts").delete();
    if (draftId) {
      query = query.eq("id", draftId);
    } else if (productId) {
      query = query.eq("product_id", productId);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Draft deleted safely. Live product untouched." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});
