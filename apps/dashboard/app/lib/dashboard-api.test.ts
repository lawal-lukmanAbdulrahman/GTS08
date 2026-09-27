import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDashboard, dashboardCsv, type DashboardData } from "./dashboard-api";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("gts_token", "tok");
});

const EMPTY: DashboardData = {
  period: "7d",
  cards: { bank_payouts: { total: 0, change_pct: 0 }, cash_in_register: { today: 0 }, repeat_buyers: { pct: 0, repeat: 0, buyers: 0 }, completed_sales: { pct: 0, paid: 0, total: 0 } },
  revenue: { total: 0, change_pct: 0, series: [{ date: "2026-09-23", label: "Wed", revenue: 0 }] },
  profits: { best_margin: [], best_sellers: [] },
  funnel: { visits: 0, cart_adds: 0, checkouts: 0, paid: 0, abandoned: 0, conversion_pct: 0 },
  visits: { total: 0, change_pct: 0, series: [] },
  unsold: [],
  sizes: [],
  staff: [],
  promos: [],
  recent_orders: [],
};

describe("loadDashboard", () => {
  it("asks for the chosen period with the staff token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: EMPTY }), { status: 200 }));
    expect(await loadDashboard("30d")).toEqual({ ok: true, data: EMPTY });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/v1/analytics/dashboard?period=30d");
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer tok");
  });

  it("says the session expired on 401 and 403, so the page can send them to sign in", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await loadDashboard("7d")).toEqual({ ok: false, expired: true, message: expect.any(String) });
  });

  it("gives a message on other failures", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Something went wrong." }), { status: 500 }));
    expect(await loadDashboard("7d")).toEqual({ ok: false, expired: false, message: "Something went wrong." });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await loadDashboard("7d")).ok).toBe(false);
  });
});

describe("dashboardCsv", () => {
  it("exports the summary and revenue by day in naira, with quoting", () => {
    const csv = dashboardCsv({ ...EMPTY, cards: { ...EMPTY.cards, bank_payouts: { total: 1_250_050, change_pct: 5 } }, revenue: { total: 300_000, change_pct: null, series: [{ date: "2026-09-22", label: "Tue", revenue: 100_000 }, { date: "2026-09-23", label: "Wed", revenue: 200_000 }] } });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Metric,Value");
    expect(csv).toContain('"Bank payouts (NGN)",12500.50');
    expect(csv).toContain('"Revenue (NGN)",3000.00');
    expect(csv).toContain("2026-09-23,2000.00");
  });
});
