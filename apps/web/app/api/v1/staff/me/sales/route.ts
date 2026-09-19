import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import type { SalesRange } from "@gts/utils";
import { requireStaff } from "../../../_lib/staff-access";
import { loadSalesRecord, SALES_RANGES } from "../../../_lib/staff-record";

/** The signed-in staff member's own sales: totals by method and channel, voids, discounts given, recent sales. */
export async function GET(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  const range = (new URL(request.url).searchParams.get("range") || "today") as SalesRange;
  if (!SALES_RANGES.includes(range)) {
    return NextResponse.json({ error: "range must be today, week or month.", code: "INVALID_RANGE" }, { status: 400 });
  }

  const record = await loadSalesRecord(createServiceClient(), staff.user.id, range);
  if (!record.ok) return NextResponse.json({ error: record.message, code: "DATABASE_ERROR" }, { status: 500 });

  const { ok: _ok, ...data } = record;
  return NextResponse.json({ data });
}
