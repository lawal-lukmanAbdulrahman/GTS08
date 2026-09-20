import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";
import { serverError } from "../../_lib/http";

/** Someone counts as "on shift" if they did anything in this window and haven't signed out since. */
const ON_SHIFT_MINUTES = 15;
const READ_LIMIT = 5000;

interface ActivityRow {
  actor_id: string | null;
  action: string;
  created_at: string;
  actor: { id: string; full_name: string | null; role: string } | null;
}

/** A table we can't read counts as nothing to do, rather than taking the whole badge down. */
async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  return error || !Array.isArray(data) ? [] : (data as T[]);
}

/**
 * The numbers behind the admin bell and the "on shift" avatars, read from the
 * real tables on every call. The dashboard polls it, so the badge follows what
 * actually needs doing instead of a fixed number.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  try {
    const client = createServiceClient();
    const since = new Date(Date.now() - ON_SHIFT_MINUTES * 60_000).toISOString();

    const [orders, flags, stock, activity] = await Promise.all([
      rows<{ status: string; channel: string }>(
        client.from("orders").select("status, channel").in("status", ["paid", "confirmed", "pending_payment"]).limit(READ_LIMIT)
      ),
      rows<{ id: string }>(client.from("product_flags").select("id").eq("status", "open").limit(READ_LIMIT)),
      rows<{ quantity: number; reserved_quantity: number; low_stock_threshold: number }>(
        client.from("inventory").select("quantity, reserved_quantity, low_stock_threshold").limit(READ_LIMIT)
      ),
      rows<ActivityRow>(
        client
          .from("activity_logs")
          .select("actor_id, action, created_at, actor:users(id, full_name, role)")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500)
      ),
    ]);

    // Newest first, so the first row seen for a person is their latest action.
    const latest = new Map<string, ActivityRow>();
    for (const row of activity) {
      if (row.actor_id && row.actor && !latest.has(row.actor_id)) latest.set(row.actor_id, row);
    }
    const activeStaff = [...latest.values()]
      .filter((r) => r.action !== "auth.logout")
      .map((r) => ({ id: r.actor!.id, full_name: r.actor!.full_name, role: r.actor!.role, last_action: r.action, last_seen: r.created_at }));

    return NextResponse.json(
      {
        data: {
          counts: {
            orders_to_ship: orders.filter((o) => o.channel === "online" && (o.status === "paid" || o.status === "confirmed")).length,
            whatsapp_waiting: orders.filter((o) => o.channel === "whatsapp" && o.status === "pending_payment").length,
            open_flags: flags.length,
            low_stock: stock.filter((s) => s.quantity - s.reserved_quantity <= s.low_stock_threshold).length,
          },
          active_staff: activeStaff,
          generated_at: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError(err);
  }
}
