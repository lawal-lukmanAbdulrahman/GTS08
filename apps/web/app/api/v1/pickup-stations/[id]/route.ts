import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { dbError, serverError } from "../../_lib/http";
import { sanitizeSqlInput } from "../../auth/utils";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("pickup_stations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Pickup station not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return serverError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { id } = await params;
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = sanitizeSqlInput(body.name?.trim() || "");
    if (body.address_line1 !== undefined) updates.address_line1 = sanitizeSqlInput(body.address_line1?.trim() || "");
    if (body.address_line2 !== undefined) updates.address_line2 = body.address_line2 ? sanitizeSqlInput(body.address_line2.trim()) : null;
    if (body.city !== undefined) updates.city = sanitizeSqlInput(body.city?.trim() || "");
    if (body.state !== undefined) updates.state = sanitizeSqlInput(body.state?.trim() || "Lagos");
    if (body.phone !== undefined) updates.phone = body.phone ? sanitizeSqlInput(body.phone.trim()) : null;
    if (body.operating_hours !== undefined) updates.operating_hours = body.operating_hours ? sanitizeSqlInput(body.operating_hours.trim()) : null;
    if (body.notes !== undefined) updates.notes = body.notes ? sanitizeSqlInput(body.notes.trim()) : null;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.is_default !== undefined) updates.is_default = Boolean(body.is_default);

    if (updates.name === "") {
      return NextResponse.json({ error: "Pickup station name cannot be blank.", code: "NAME_REQUIRED" }, { status: 400 });
    }
    if (updates.address_line1 === "") {
      return NextResponse.json({ error: "Street address cannot be blank.", code: "ADDRESS_REQUIRED" }, { status: 400 });
    }
    if (updates.city === "") {
      return NextResponse.json({ error: "City cannot be blank.", code: "CITY_REQUIRED" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // If setting this station as default, unset others
    if (updates.is_default === true) {
      await serviceClient
        .from("pickup_stations")
        .update({ is_default: false })
        .neq("id", id);
    }

    const { data: updated, error } = await serviceClient
      .from("pickup_stations")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return dbError(error);

    return NextResponse.json({ data: updated, success: true });
  } catch (err: any) {
    return serverError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const serviceClient = createServiceClient();

    // Check if station is linked to any orders
    const { count } = await serviceClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("pickup_station_id", id);

    if (count && count > 0) {
      // Soft delete: deactivate so historical orders remain valid
      const { error: updateErr } = await serviceClient
        .from("pickup_stations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updateErr) return dbError(updateErr);

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: "Station is linked to previous orders, so it was set to inactive instead of permanently deleted.",
      });
    }

    // Hard delete if never referenced
    const { error: delErr } = await serviceClient
      .from("pickup_stations")
      .delete()
      .eq("id", id);

    if (delErr) return dbError(delErr);

    return NextResponse.json({ success: true, message: "Station deleted successfully." });
  } catch (err: any) {
    return serverError(err);
  }
}
