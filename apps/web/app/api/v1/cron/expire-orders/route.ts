import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireCron } from "../../_lib/cron";
import { serverError } from "../../_lib/http";
import { adjustAll, type InventoryChange } from "../../pos/_lib/inventory";
import { transitionOrderStatus } from "../../pos/_lib/order-status";

const BATCH = 200;

function positiveNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Cancels orders that were never paid, freeing whatever stock they hold:
 *  - WhatsApp orders after WHATSAPP_ORDER_EXPIRY_HOURS (default 24), since they reserve stock;
 *  - online orders after ONLINE_ORDER_EXPIRY_MINUTES (default 60).
 * Each order is claimed with a compare-and-swap, so an order paid or cancelled a
 * moment earlier is left alone, and running the job twice does nothing new.
 */
async function run(request: NextRequest) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;

  try {
    const client = createServiceClient();
    const now = Date.now();
    const windows = [
      { channel: "whatsapp", cutoff: new Date(now - positiveNumber("WHATSAPP_ORDER_EXPIRY_HOURS", 24) * 3_600_000), label: "unpaid WhatsApp order" },
      { channel: "online", cutoff: new Date(now - positiveNumber("ONLINE_ORDER_EXPIRY_MINUTES", 60) * 60_000), label: "unpaid online order" },
    ];

    let expired = 0;
    let failed = 0;

    for (const w of windows) {
      const { data, error } = await client
        .from("orders")
        .select("id, channel, internal_notes, items:order_items(variant_id, quantity)")
        .eq("status", "pending_payment")
        .eq("channel", w.channel)
        .lt("created_at", w.cutoff.toISOString())
        .limit(BATCH);
      if (error) throw new Error(error.message);

      const rows = (data || []) as unknown as Array<{ id: string; internal_notes: string | null; items: Array<{ variant_id: string | null; quantity: number }> | null }>;
      for (const order of rows) {
        try {
          const notes = [order.internal_notes, `Expired: ${w.label}, never paid.`].filter(Boolean).join("\n");
          const claimed = await transitionOrderStatus(client, order.id, "pending_payment", { status: "cancelled", internal_notes: notes });
          if (!claimed) continue;
          const release: InventoryChange[] = (order.items || [])
            .filter((i) => i.variant_id)
            .map((i) => ({ variantId: i.variant_id as string, deltaReserved: -i.quantity, clampReserved: true }));
          if (release.length > 0) await adjustAll(client, release);
          expired += 1;
        } catch (err) {
          console.error("[cron/expire-orders] could not expire", order.id, err);
          failed += 1;
        }
      }
    }

    return NextResponse.json({ data: { expired, failed } });
  } catch (err) {
    return serverError(err);
  }
}

export const GET = run; // Vercel Cron calls with GET
export const POST = run;
