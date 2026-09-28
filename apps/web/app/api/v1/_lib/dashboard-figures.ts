import { startOfWATDay } from "@gts/utils";
import { dailySeries, PAID_STATUSES, pctChange, type Period } from "./analytics";

/** Everything the admin dashboard shows, computed from real records. Money is kobo throughout. */

interface Line {
  quantity: number;
  line_total: number;
  product_snapshot: { id?: string; name?: string; size?: string | null } | null;
}

export interface DashboardInput {
  period: Period;
  now: Date;
  /** Orders created in the period (any status), with their lines. */
  orders: Array<{
    id: string;
    total: number;
    channel: string;
    status: string;
    created_at: string;
    customer_id: string | null;
    cashier_id: string | null;
    discount_amount: number | null;
    promo_code: string | null;
    items: Line[] | null;
  }>;
  /** Orders created in the period before, for comparison. */
  previousOrders: Array<{ total: number; channel: string; status: string; created_at: string }>;
  /** customer_id of every paid order ever, for repeat buyers. */
  paidCustomerIds: Array<string | null>;
  transactions: Array<{ payment_method: string; payment_status: string; amount: number; created_at: string }>;
  previousTransactions: Array<{ payment_method: string; payment_status: string; amount: number; created_at: string }>;
  products: Array<{ id: string; name: string; base_price: number; cost_price: number | null; status: string; category: { name: string } | null }>;
  /** One row per variant's stock, with the product it belongs to. */
  stock: Array<{ product_id: string; quantity: number; reserved_quantity: number }>;
  /** Storefront events (product_views) in the period and the one before. */
  views: Array<{ session_id: string | null; event_type: string; created_at: string }>;
  previousViews: Array<{ session_id: string | null; event_type: string; created_at: string }>;
  staff: Array<{ id: string; full_name: string | null }>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOP = 6;

const isPaid = (status: string) => PAID_STATUSES.includes(status);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** Money that lands in the bank: card, transfer, USSD and QR online, and the card terminal in store. */
const toBank = (method: string) => method.startsWith("paystack_") || method === "pos_terminal";

function dayLabel(date: string, byWeekday: boolean): string {
  const d = new Date(`${date}T12:00:00Z`);
  return byWeekday ? WEEKDAYS[d.getUTCDay()]! : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function distinctSessions(views: DashboardInput["views"], event?: string): Set<string> {
  const out = new Set<string>();
  for (const v of views) if (v.session_id && (!event || v.event_type === event)) out.add(v.session_id);
  return out;
}

export function buildDashboard(input: DashboardInput) {
  const { period, now } = input;
  const byWeekday = (period.to.getTime() - period.from.getTime()) / 86_400_000 <= 7;

  const paid = input.orders.filter((o) => isPaid(o.status));
  const previousPaid = input.previousOrders.filter((o) => isPaid(o.status));
  const lines = paid.flatMap((o) => o.items ?? []);

  // ── The four summary cards
  const bank = (txns: DashboardInput["transactions"]) => sum(txns.filter((t) => t.payment_status === "success" && toBank(t.payment_method)).map((t) => t.amount));
  const bankNow = bank(input.transactions);
  const today = startOfWATDay(now).getTime();
  const cashToday = sum(
    input.transactions.filter((t) => t.payment_status === "success" && t.payment_method === "cash" && new Date(t.created_at).getTime() >= today).map((t) => t.amount)
  );
  const ordersPerCustomer = new Map<string, number>();
  for (const id of input.paidCustomerIds) if (id) ordersPerCustomer.set(id, (ordersPerCustomer.get(id) ?? 0) + 1);
  const repeat = [...ordersPerCustomer.values()].filter((n) => n >= 2).length;

  // ── Revenue
  const revenueTotal = sum(paid.map((o) => o.total));
  const series = dailySeries(paid, period.from, period.to).map((d) => ({ date: d.date, label: dayLabel(d.date, byWeekday), revenue: d.revenue }));

  // ── Product profits
  const bestMargin = input.products
    .filter((p) => p.status === "active" && p.base_price > 0 && (p.cost_price ?? 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, category: p.category?.name ?? null, cost: p.cost_price!, price: p.base_price, margin_pct: Math.round(((p.base_price - p.cost_price!) / p.base_price) * 100) }))
    .sort((a, b) => b.margin_pct - a.margin_pct)
    .slice(0, TOP);
  const sold = new Map<string, { id: string; name: string; units: number; revenue: number }>();
  for (const l of lines) {
    const id = l.product_snapshot?.id;
    if (!id) continue;
    const row = sold.get(id) ?? { id, name: l.product_snapshot?.name ?? "Product", units: 0, revenue: 0 };
    row.units += l.quantity;
    row.revenue += l.line_total;
    sold.set(id, row);
  }
  const bestSellers = [...sold.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units).slice(0, TOP);

  // ── Storefront funnel and visits
  const visitors = distinctSessions(input.views);
  const carts = distinctSessions(input.views, "cart_add");
  // Storefront checkouts: paid online, or held for pay-on-pickup.
  const online = input.orders.filter((o) => o.channel === "online" || o.channel === "pickup");
  const onlinePaid = online.filter((o) => isPaid(o.status)).length;
  const previousVisitors = distinctSessions(input.previousViews).size;
  const visitSeries = dailySeries([], period.from, period.to).map((d) => ({
    date: d.date,
    label: dayLabel(d.date, byWeekday),
    visits: distinctSessions(input.views.filter((v) => new Date(new Date(v.created_at).getTime() + 3_600_000).toISOString().slice(0, 10) === d.date)).size,
  }));

  // ── Unsold stock: available units of products that sold nothing in the period
  const byName = new Map(input.products.map((p) => [p.id, p]));
  const available = new Map<string, number>();
  for (const s of input.stock) available.set(s.product_id, (available.get(s.product_id) ?? 0) + Math.max(0, s.quantity - s.reserved_quantity));
  const unsold = [...available.entries()]
    .filter(([id, units]) => units > 0 && !sold.has(id) && byName.has(id))
    .map(([id, units]) => {
      const p = byName.get(id)!;
      return { product_id: id, name: p.name, units, value: units * (p.cost_price ?? p.base_price) };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ── Sizes
  const bySize = new Map<string, number>();
  for (const l of lines) {
    const size = l.product_snapshot?.size?.trim() || "One size";
    bySize.set(size, (bySize.get(size) ?? 0) + l.quantity);
  }
  const unitsSold = sum([...bySize.values()]);
  const sizes = [...bySize.entries()]
    .map(([size, units]) => ({ size, units, share_pct: pct(units, unitsSold) }))
    .sort((a, b) => b.units - a.units)
    .slice(0, TOP);

  // ── Staff and promos
  const names = new Map(input.staff.map((s) => [s.id, s.full_name || "Staff member"]));
  const staff = new Map<string, { cashier_id: string; name: string; orders: number; sales: number; discounts: number }>();
  const promos = new Map<string, { code: string; uses: number; revenue: number; discount: number }>();
  for (const o of paid) {
    if (o.cashier_id) {
      const row = staff.get(o.cashier_id) ?? { cashier_id: o.cashier_id, name: names.get(o.cashier_id) ?? "Former staff", orders: 0, sales: 0, discounts: 0 };
      row.orders += 1;
      row.sales += o.total;
      row.discounts += o.discount_amount ?? 0;
      staff.set(o.cashier_id, row);
    }
    if (o.promo_code) {
      const code = o.promo_code.toUpperCase();
      const row = promos.get(code) ?? { code, uses: 0, revenue: 0, discount: 0 };
      row.uses += 1;
      row.revenue += o.total;
      row.discount += o.discount_amount ?? 0;
      promos.set(code, row);
    }
  }

  return {
    period: period.key,
    cards: {
      bank_payouts: { total: bankNow, change_pct: pctChange(bankNow, bank(input.previousTransactions)) },
      cash_in_register: { today: cashToday },
      repeat_buyers: { pct: pct(repeat, ordersPerCustomer.size), repeat, buyers: ordersPerCustomer.size },
      completed_sales: { pct: pct(paid.length, input.orders.length), paid: paid.length, total: input.orders.length },
    },
    revenue: { total: revenueTotal, change_pct: pctChange(revenueTotal, sum(previousPaid.map((o) => o.total))), series },
    profits: { best_margin: bestMargin, best_sellers: bestSellers },
    funnel: {
      visits: visitors.size,
      cart_adds: carts.size,
      checkouts: online.length,
      paid: onlinePaid,
      abandoned: Math.max(0, online.length - onlinePaid),
      conversion_pct: pct(onlinePaid, visitors.size),
    },
    visits: { total: visitors.size, change_pct: pctChange(visitors.size, previousVisitors), series: visitSeries },
    unsold,
    sizes,
    staff: [...staff.values()].sort((a, b) => b.sales - a.sales).slice(0, 5),
    promos: [...promos.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
