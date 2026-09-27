import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { DashboardData } from "../lib/dashboard-api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/admin" }));
vi.mock("./sidebar-context", () => ({ AdminTopStrip: () => null }));
const loadDashboard = vi.fn();
vi.mock("../lib/dashboard-api", async (orig) => ({ ...(await orig<typeof import("../lib/dashboard-api")>()), loadDashboard: (p: string) => loadDashboard(p) }));

import AdminPage from "./page";

const EMPTY: DashboardData = {
  period: "7d",
  cards: { bank_payouts: { total: 0, change_pct: 0 }, cash_in_register: { today: 0 }, repeat_buyers: { pct: 0, repeat: 0, buyers: 0 }, completed_sales: { pct: 0, paid: 0, total: 0 } },
  revenue: { total: 0, change_pct: 0, series: ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"].map((label, i) => ({ date: `2026-09-${17 + i}`, label, revenue: 0 })) },
  profits: { best_margin: [], best_sellers: [] },
  funnel: { visits: 0, cart_adds: 0, checkouts: 0, paid: 0, abandoned: 0, conversion_pct: 0 },
  visits: { total: 0, change_pct: 0, series: [] },
  unsold: [],
  sizes: [],
  staff: [],
  promos: [],
  recent_orders: [],
};

const FULL: DashboardData = {
  ...EMPTY,
  cards: { bank_payouts: { total: 12_345_600, change_pct: 12.5 }, cash_in_register: { today: 4_500_000 }, repeat_buyers: { pct: 40, repeat: 2, buyers: 5 }, completed_sales: { pct: 75, paid: 3, total: 4 } },
  revenue: { total: 9_900_000, change_pct: -3.2, series: EMPTY.revenue.series.map((p, i) => ({ ...p, revenue: i === 6 ? 9_900_000 : 0 })) },
  profits: { best_margin: [{ id: "p1", name: "Denim Jacket", category: "Outerwear", cost: 1_800_000, price: 6_480_000, margin_pct: 72 }], best_sellers: [{ id: "p2", name: "Oxford Shirt", units: 3, revenue: 14_400_000 }] },
  funnel: { visits: 120, cart_adds: 30, checkouts: 10, paid: 6, abandoned: 4, conversion_pct: 5 },
  visits: { total: 120, change_pct: 20, series: [{ date: "2026-09-22", label: "Tue", visits: 50 }, { date: "2026-09-23", label: "Wed", visits: 70 }] },
  unsold: [{ product_id: "p9", name: "Idle Coat", units: 4, value: 8_000_000 }],
  sizes: [{ size: "M", units: 6, share_pct: 60 }],
  staff: [{ cashier_id: "c1", name: "Ada Cashier", orders: 4, sales: 9_000_000, discounts: 50_000 }],
  promos: [{ code: "SAVE10", uses: 2, revenue: 2_700_000, discount: 300_000 }],
  recent_orders: [{ id: "o1", order_number: "GTS-202609-000001", channel: "walk_in", status: "completed", total: 9_900_000, created_at: "2026-09-23T10:00:00Z", customer: null }],
};

beforeEach(() => {
  push.mockReset();
  loadDashboard.mockReset();
  localStorage.setItem("gts_token", "tok");
  localStorage.setItem("gts_user", JSON.stringify({ full_name: "Olareign Lawal", role: "admin" }));
});

describe("Admin dashboard", () => {
  it("shows zeros and empty states for a new live shop, and none of the old made-up figures", async () => {
    loadDashboard.mockResolvedValue({ ok: true, data: EMPTY });
    const { container } = render(<AdminPage />);
    await screen.findByText("Bank payouts");
    for (const fake of ["285,400", "45,200", "42.8%", "88.4%", "102.4M", "68.5%", "Urban Vintage", "12.5%"]) expect(container.textContent).not.toContain(fake);
    expect(screen.getByTestId("card-bank-payouts")).toHaveTextContent("₦0");
    expect(screen.getByTestId("card-completed-sales")).toHaveTextContent("0 paid out of 0");
    expect(screen.getByText(/no sales in this period yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no recent orders/i)).toBeInTheDocument();
  });

  it("shows the real figures", async () => {
    loadDashboard.mockResolvedValue({ ok: true, data: FULL });
    render(<AdminPage />);
    expect(await screen.findByTestId("card-bank-payouts")).toHaveTextContent("₦123,456");
    expect(screen.getByTestId("card-bank-payouts")).toHaveTextContent("+12.5%");
    expect(screen.getByTestId("card-cash")).toHaveTextContent("₦45,000");
    expect(screen.getByTestId("card-repeat")).toHaveTextContent("40%");
    expect(screen.getByTestId("card-repeat")).toHaveTextContent("2 of 5 buyers");
    expect(screen.getByText("Denim Jacket")).toBeInTheDocument();
    expect(screen.getByText("72% margin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /best sellers/i }));
    expect(screen.getByText("Oxford Shirt")).toBeInTheDocument();
    expect(within(screen.getByTestId("funnel")).getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Idle Coat")).toBeInTheDocument();
    expect(screen.getByText("Ada Cashier")).toBeInTheDocument();
    expect(screen.getByText("SAVE10")).toBeInTheDocument();
    expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
  });

  it("greets the signed-in person by first name", async () => {
    loadDashboard.mockResolvedValue({ ok: true, data: EMPTY });
    render(<AdminPage />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/Olareign/);
  });

  it("reloads for the monthly view", async () => {
    loadDashboard.mockResolvedValue({ ok: true, data: EMPTY });
    render(<AdminPage />);
    await screen.findByText("Bank payouts");
    fireEvent.change(screen.getByLabelText(/revenue period/i), { target: { value: "30d" } });
    await waitFor(() => expect(loadDashboard).toHaveBeenLastCalledWith("30d"));
  });

  it("sends an expired session to sign in", async () => {
    loadDashboard.mockResolvedValue({ ok: false, expired: true, message: "x" });
    render(<AdminPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login?redirect=/admin"));
  });

  it("shows a load failure with a way to retry", async () => {
    loadDashboard.mockResolvedValueOnce({ ok: false, expired: false, message: "Couldn't reach the server." }).mockResolvedValue({ ok: true, data: EMPTY });
    render(<AdminPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach/i);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByText("Bank payouts");
  });
});
