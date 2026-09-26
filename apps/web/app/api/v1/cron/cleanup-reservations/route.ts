import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireCron } from "../../_lib/cron";
import { serverError } from "../../_lib/http";
import { adjustInventory } from "../../pos/_lib/inventory";

const BATCH = 500;

/**
 * Releases checkout reservations whose hold has run out, returning the stock to
 * sale. A reservation is marked released only after its stock was returned, so a
 * failure is simply retried on the next run.
 */
async function run(request: NextRequest) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;

  try {
    const client = createServiceClient({ allModes: true });
    const { data, error } = await client
      .from("checkout_reservations")
      .select("id, variant_id, quantity")
      .eq("released", false)
      .lt("expires_at", new Date().toISOString())
      .limit(BATCH);
    if (error) throw new Error(error.message);

    let released = 0;
    let failed = 0;
    for (const r of (data || []) as Array<{ id: string; variant_id: string; quantity: number }>) {
      const done = await adjustInventory(client, { variantId: r.variant_id, deltaReserved: -r.quantity, clampReserved: true });
      if (!done.ok) {
        failed += 1;
        continue;
      }
      await client.from("checkout_reservations").update({ released: true }).eq("id", r.id).eq("released", false);
      released += 1;
    }
    return NextResponse.json({ data: { released, failed } });
  } catch (err) {
    return serverError(err);
  }
}

export const GET = run; // Vercel Cron calls with GET
export const POST = run;
