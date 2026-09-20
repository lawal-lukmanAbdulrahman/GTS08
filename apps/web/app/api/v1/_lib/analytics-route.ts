import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { PAID_STATUSES, parsePeriod, type Period } from "./analytics";
import { serverError } from "./http";

type Client = ReturnType<typeof createServiceClient>;
export interface OrderRow {
  total: number;
  channel: string;
  created_at: string;
}

const READ_LIMIT = 20_000;

/** Paid orders created in [from, to). Throws on a database error (the caller's catch turns it into a safe 500). */
export async function loadPaidOrders(client: Client, from: Date, to: Date, channel?: string): Promise<OrderRow[]> {
  let query = client
    .from("orders")
    .select("total, channel, created_at")
    .in("status", PAID_STATUSES)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .limit(READ_LIMIT);
  if (channel) query = query.eq("channel", channel);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

/**
 * The shell every analytics endpoint shares: a validated period, a safe error, and
 * never cached (these numbers are looked at because they're current). Each route
 * checks `requireAdmin` itself before calling this.
 */
export async function analytics(
  request: NextRequest,
  run: (ctx: { client: Client; period: Period; params: URLSearchParams }) => Promise<unknown>,
  { needsPeriod = true }: { needsPeriod?: boolean } = {}
): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const parsed = needsPeriod ? parsePeriod(params) : parsePeriod(new URLSearchParams());
  if (!parsed.ok) return NextResponse.json({ error: parsed.message, code: "INVALID_PERIOD" }, { status: 400 });

  try {
    const data = await run({ client: createServiceClient(), period: parsed.period, params });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const res = serverError(err);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
