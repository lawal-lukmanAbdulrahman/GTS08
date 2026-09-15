import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { withIdempotency } from "@/lib/idempotency";

export const PUT = withIdempotency(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(request);

    const serviceClient = createServiceClient();
    const body = await request.json();
    const { adjustment_type, quantity, reason, notes, low_stock_threshold } = body;

    // Get current inventory row by variant_id or id
    let { data: currentInv, error: fetchErr } = await serviceClient
      .from("inventory")
      .select("*")
      .or(`variant_id.eq.${id},id.eq.${id}`)
      .maybeSingle();

    if (fetchErr || !currentInv) {
      return NextResponse.json({ error: "Inventory record not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (low_stock_threshold !== undefined && !isNaN(Number(low_stock_threshold))) {
      updates.low_stock_threshold = Number(low_stock_threshold);
    }

    let delta = 0;

    if (adjustment_type && quantity !== undefined) {
      let newQuantity = currentInv.quantity;

      if (adjustment_type === "add") {
        delta = Number(quantity);
        newQuantity += Number(quantity);
        updates.last_restocked_at = new Date().toISOString();
      } else if (adjustment_type === "remove") {
        delta = -Number(quantity);
        newQuantity = Math.max(0, newQuantity - Number(quantity));
      } else if (adjustment_type === "set") {
        delta = Number(quantity) - currentInv.quantity;
        newQuantity = Number(quantity);
      }

      updates.quantity = newQuantity;
    }

    // Update inventory quantity and/or threshold
    const { data: updatedInv, error: updateErr } = await serviceClient
      .from("inventory")
      .update(updates)
      .eq("id", currentInv.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message, code: "DATABASE_ERROR" }, { status: 400 });
    }

    // Insert stock movement record if quantity changed
    if (delta !== 0 && reason) {
      await serviceClient.from("stock_movements").insert({
        variant_id: currentInv.variant_id,
        delta,
        reason: reason || "adjustment",
        actor_id: user?.id || null,
        notes: notes || null,
      });
    }

    return NextResponse.json({ data: updatedInv });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});
