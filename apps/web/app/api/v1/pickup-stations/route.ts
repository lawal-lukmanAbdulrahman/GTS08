import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin, optionalStaff } from "../_lib/staff-access";
import { dbError, serverError } from "../_lib/http";
import { sanitizeSqlInput } from "../auth/utils";

export async function GET(request: NextRequest) {
  try {
    const serviceClient = createServiceClient();
    const isAll = request.nextUrl.searchParams.get("all") === "true";

    let showAll = false;
    if (isAll) {
      const staff = await optionalStaff(request);
      if (staff) {
        showAll = true;
      }
    }

    let query = serviceClient
      .from("pickup_stations")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (!showAll) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist yet, return empty list or fallback from settings gracefully
      if (/pickup_stations.*does not exist/i.test(error.message)) {
        return NextResponse.json({ data: [] });
      }
      return dbError(error);
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return serverError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
    }

    const name = sanitizeSqlInput(body.name?.trim() || "");
    const addressLine1 = sanitizeSqlInput(body.address_line1?.trim() || "");
    const addressLine2 = body.address_line2 ? sanitizeSqlInput(body.address_line2.trim()) : null;
    const city = sanitizeSqlInput(body.city?.trim() || "");
    const state = sanitizeSqlInput(body.state?.trim() || "Lagos");
    const phone = body.phone ? sanitizeSqlInput(body.phone.trim()) : null;
    const operatingHours = body.operating_hours ? sanitizeSqlInput(body.operating_hours.trim()) : null;
    const notes = body.notes ? sanitizeSqlInput(body.notes.trim()) : null;
    const isActive = body.is_active !== false;
    const isDefault = body.is_default === true;

    if (!name) {
      return NextResponse.json({ error: "Pickup station name is required.", code: "NAME_REQUIRED" }, { status: 400 });
    }
    if (!addressLine1) {
      return NextResponse.json({ error: "Street address (line 1) is required.", code: "ADDRESS_REQUIRED" }, { status: 400 });
    }
    if (!city) {
      return NextResponse.json({ error: "City is required.", code: "CITY_REQUIRED" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // If making this station default, unset previous default
    if (isDefault) {
      await serviceClient
        .from("pickup_stations")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    const { data: created, error } = await serviceClient
      .from("pickup_stations")
      .insert({
        name,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        phone,
        operating_hours: operatingHours,
        notes,
        is_active: isActive,
        is_default: isDefault,
      })
      .select("*")
      .single();

    if (error) return dbError(error);

    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (err: any) {
    return serverError(err);
  }
}
