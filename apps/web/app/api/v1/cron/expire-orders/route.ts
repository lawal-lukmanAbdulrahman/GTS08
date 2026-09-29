import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireCron } from "../../_lib/cron";
import { serverError } from "../../_lib/http";
import { adjustAll, type InventoryChange } from "../../pos/_lib/inventory";
import { transitionOrderStatus } from "../../pos/_lib/order-status";
import { logActivity } from "../../_lib/activity";
import { notifyOrderStatus } from "../../_lib/email/events";

const BATCH = 200;
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

function positiveNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Cancels orders that were never paid, freeing whatever stock they hold:
 *  - WhatsApp orders after WHATSAPP_ORDER_EXPIRY_HOURS (default 24);
 *  - online orders after ONLINE_ORDER_EXPIRY_MINUTES (default 60);
 *  - pay-on-pickup orders once their pickup deadline passes;
 *  - ready_for_pickup orders once their pickup window lapses (set to 'expired').
 */
async function run(request: NextRequest) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;

  try {
    const client = createServiceClient({ allModes: true });
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

    // Pay-on-pickup orders: each has its own deadline, set from the admin's hold time when it was placed.
    const { data: overdue, error: overdueError } = await client
      .from("orders")
      .select("id, channel, internal_notes, items:order_items(variant_id, quantity)")
      .eq("status", "pending_payment")
      .eq("channel", "pickup")
      .lt("pickup_deadline", new Date(now).toISOString())
      .limit(BATCH);
    if (overdueError) throw new Error(overdueError.message);
    for (const order of (overdue || []) as unknown as Array<{ id: string; internal_notes: string | null; items: Array<{ variant_id: string | null; quantity: number }> | null }>) {
      try {
        const notes = [order.internal_notes, "Expired: not collected and paid by the pickup deadline."].filter(Boolean).join("\n");
        const claimed = await transitionOrderStatus(client, order.id, "pending_payment", { status: "cancelled", internal_notes: notes });
        if (!claimed) continue;
        const release: InventoryChange[] = (order.items || [])
          .filter((i) => i.variant_id)
          .map((i) => ({ variantId: i.variant_id as string, deltaReserved: -i.quantity, clampReserved: true }));
        if (release.length > 0) await adjustAll(client, release);
        expired += 1;
      } catch (err) {
        console.error("[cron/expire-orders] could not expire pickup order", order.id, err);
        failed += 1;
      }
    }

    // Read store settings for pickup window
    const { data: settings } = await client
      .from("settings")
      .select("pickup_window_days")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    const pickupWindowDays = settings?.pickup_window_days && Number.isFinite(settings.pickup_window_days)
      ? Number(settings.pickup_window_days)
      : 7;

    const readyCutoff = new Date(now - pickupWindowDays * 86_400_000).toISOString();

    // Ready for pickup orders that have lapsed beyond the pickup window
    const { data: overdueReady, error: readyErr } = await client
      .from("orders")
      .select("id, order_number, status, payment_status, internal_notes, pickup_deadline, ready_for_pickup_at, items:order_items(variant_id, quantity)")
      .eq("status", "ready_for_pickup")
      .or(`pickup_deadline.lt.${new Date(now).toISOString()},ready_for_pickup_at.lt.${readyCutoff}`)
      .limit(BATCH);

    if (readyErr) throw new Error(readyErr.message);

    for (const order of (overdueReady || []) as unknown as Array<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      internal_notes: string | null;
      items: Array<{ variant_id: string | null; quantity: number }> | null;
    }>) {
      try {
        const notes = [order.internal_notes, `Expired: pickup window lapsed (${pickupWindowDays} days).`].filter(Boolean).join("\n");
        const claimed = await transitionOrderStatus(client, order.id, "ready_for_pickup", {
          status: "expired",
          internal_notes: notes,
          updated_at: new Date(now).toISOString(),
        });

        if (!claimed) continue;

        // Release hold if order was never paid
        if (order.payment_status !== "paid") {
          const release: InventoryChange[] = (order.items || [])
            .filter((i) => i.variant_id)
            .map((i) => ({ variantId: i.variant_id as string, deltaReserved: -i.quantity, clampReserved: true }));
          if (release.length > 0) await adjustAll(client, release);
        }

        await logActivity(client, {
          actorId: "00000000-0000-0000-0000-000000000000",
          action: "order.status",
          targetType: "order",
          targetId: order.id,
          changes: {
            from: "ready_for_pickup",
            to: "expired",
            reason: `Pickup window lapsed (${pickupWindowDays} days)`,
          },
        });

        notifyOrderStatus(client, order.id, "expired", `Pickup window lapsed (${pickupWindowDays} days)`);
        expired += 1;
      } catch (err) {
        console.error("[cron/expire-orders] could not expire ready order", order.id, err);
        failed += 1;
      }
    }

    return NextResponse.json({ data: { expired, failed, pickup_window_days: pickupWindowDays } });
  } catch (err) {
    return serverError(err);
  }
}

export const GET = run;
export const POST = run;
