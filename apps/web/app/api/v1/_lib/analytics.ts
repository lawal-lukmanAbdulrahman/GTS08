import { startOfWATDay } from "@gts/utils";

const DAY_MS = 86_400_000;
const WAT_MS = 3_600_000; // Lagos is UTC+1 all year
const MAX_RANGE_DAYS = 366;

/** Orders that count as money received. Unpaid, cancelled and voided ones never do. */
export const PAID_STATUSES = ["paid", "confirmed", "processing", "shipped", "delivered", "completed"];

export interface Period {
  key: string;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD as midnight in Lagos, or null if it isn't a real date. */
function watMidnight(value: string | null): Date | null {
  if (!value || !DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return new Date(d.getTime() - WAT_MS);
}

/** today, 7d, 30d (ending now, in Lagos days) or a custom from/to (both days included). */
export function parsePeriod(params: URLSearchParams, now: Date = new Date()): { ok: true; period: Period } | { ok: false; message: string } {
  const has = params.has("from") || params.has("to");
  const key = params.get("period") ?? (has ? "custom" : "7d");
  let from: Date;
  let to: Date = now;

  if (key === "today") from = startOfWATDay(now);
  else if (key === "7d") from = new Date(startOfWATDay(now).getTime() - 6 * DAY_MS);
  else if (key === "30d") from = new Date(startOfWATDay(now).getTime() - 29 * DAY_MS);
  else if (key === "custom") {
    const start = watMidnight(params.get("from"));
    const end = watMidnight(params.get("to"));
    if (!start || !end) return { ok: false, message: "Give from and to as dates like 2026-09-01." };
    from = start;
    to = new Date(end.getTime() + DAY_MS);
    if (to <= from) return { ok: false, message: "The end date must not be before the start date." };
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) return { ok: false, message: `Choose a range of at most ${MAX_RANGE_DAYS} days.` };
  } else {
    return { ok: false, message: "period must be today, 7d, 30d or custom." };
  }

  const length = to.getTime() - from.getTime();
  return { ok: true, period: { key, from, to, prevFrom: new Date(from.getTime() - length), prevTo: from } };
}

interface OrderLike {
  total: number;
  channel: string;
  created_at: string;
}

export function summarize(orders: OrderLike[]) {
  const revenue = { total: 0, online: 0, walkin: 0, whatsapp: 0 };
  const count = { total: 0, online: 0, walkin: 0, whatsapp: 0 };
  for (const o of orders) {
    const bucket = o.channel === "online" ? "online" : o.channel === "whatsapp" ? "whatsapp" : "walkin";
    revenue.total += o.total;
    revenue[bucket] += o.total;
    count.total += 1;
    count[bucket] += 1;
  }
  return { revenue, orders: count, average_order_value: count.total ? Math.round(revenue.total / count.total) : 0 };
}

/** Change against the earlier period, to one decimal. Null when there was nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const watDay = (iso: string) => new Date(new Date(iso).getTime() + WAT_MS).toISOString().slice(0, 10);

/** One row per Lagos day between from and to, including days with no sales. */
export function dailySeries(orders: OrderLike[], from: Date, to: Date): Array<{ date: string; revenue: number; orders: number }> {
  const rows = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let t = startOfWATDay(from).getTime(); t < to.getTime(); t += DAY_MS) {
    const date = watDay(new Date(t).toISOString());
    rows.set(date, { date, revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    const row = rows.get(watDay(o.created_at));
    if (row) {
      row.revenue += o.total;
      row.orders += 1;
    }
  }
  return [...rows.values()];
}

interface LineLike {
  quantity: number;
  line_total: number;
  product_snapshot: { id?: string; name?: string } | null;
}

export function rankProducts(lines: LineLike[], limit: number) {
  const byProduct = new Map<string, { product_id: string; name: string; units: number; revenue: number }>();
  for (const l of lines) {
    const id = l.product_snapshot?.id;
    if (!id) continue;
    const row = byProduct.get(id) ?? { product_id: id, name: l.product_snapshot?.name ?? "Product", units: 0, revenue: 0 };
    row.units += l.quantity;
    row.revenue += l.line_total;
    byProduct.set(id, row);
  }
  return [...byProduct.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, limit);
}
