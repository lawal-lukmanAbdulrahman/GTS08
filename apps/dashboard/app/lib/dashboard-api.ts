import { API_BASE } from "./api-base";
import { authFetch } from "./session";

/** The admin dashboard's figures (GET /analytics/dashboard). Money is kobo; percentages are 0-100 with one decimal. */
export interface DashboardData {
  period: string;
  cards: {
    bank_payouts: { total: number; change_pct: number | null };
    cash_in_register: { today: number };
    repeat_buyers: { pct: number; repeat: number; buyers: number };
    completed_sales: { pct: number; paid: number; total: number };
  };
  revenue: { total: number; change_pct: number | null; series: Array<{ date: string; label: string; revenue: number }> };
  profits: {
    best_margin: Array<{ id: string; name: string; category: string | null; cost: number; price: number; margin_pct: number }>;
    best_sellers: Array<{ id: string; name: string; units: number; revenue: number }>;
  };
  funnel: { visits: number; cart_adds: number; checkouts: number; paid: number; abandoned: number; conversion_pct: number };
  visits: { total: number; change_pct: number | null; series: Array<{ date: string; label: string; visits: number }> };
  unsold: Array<{ product_id: string; name: string; units: number; value: number }>;
  sizes: Array<{ size: string; units: number; share_pct: number }>;
  staff: Array<{ cashier_id: string; name: string; orders: number; sales: number; discounts: number }>;
  promos: Array<{ code: string; uses: number; revenue: number; discount: number }>;
  recent_orders: Array<{ id: string; order_number: string; channel: string; status: string; total: number; created_at: string; customer?: { full_name: string | null; email: string | null } | null }>;
}

export type DashboardPeriod = "7d" | "30d";
export type LoadDashboardResult = { ok: true; data: DashboardData } | { ok: false; expired: boolean; message: string };

export async function loadDashboard(period: DashboardPeriod): Promise<LoadDashboardResult> {
  try {
    const res = await authFetch(`${API_BASE}/analytics/dashboard?period=${period}`);
    if (res.status === 401 || res.status === 403) return { ok: false, expired: true, message: "Please sign in again." };
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, expired: false, message: body?.error || "Couldn't load the dashboard." };
    return { ok: true, data: body.data as DashboardData };
  } catch {
    return { ok: false, expired: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

const naira = (kobo: number) => (kobo / 100).toFixed(2);
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** The dashboard as a spreadsheet: the summary figures, then revenue by day. */
export function dashboardCsv(d: DashboardData): string {
  const rows: string[] = ["Metric,Value"];
  rows.push(`${quote("Bank payouts (NGN)")},${naira(d.cards.bank_payouts.total)}`);
  rows.push(`${quote("Cash in register today (NGN)")},${naira(d.cards.cash_in_register.today)}`);
  rows.push(`${quote("Repeat buyers (%)")},${d.cards.repeat_buyers.pct}`);
  rows.push(`${quote("Completed sales (%)")},${d.cards.completed_sales.pct}`);
  rows.push(`${quote("Revenue (NGN)")},${naira(d.revenue.total)}`);
  rows.push(`${quote("Storefront visits")},${d.visits.total}`);
  rows.push("", "Date,Revenue (NGN)");
  for (const p of d.revenue.series) rows.push(`${p.date},${naira(p.revenue)}`);
  return rows.join("\n");
}
