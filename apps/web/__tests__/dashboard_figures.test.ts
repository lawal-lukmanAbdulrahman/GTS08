// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildDashboard, type DashboardInput } from "../app/api/v1/_lib/dashboard-figures";
import { parsePeriod } from "../app/api/v1/_lib/analytics";

// Wednesday 23 Sept 2026, 15:00 in Lagos.
const NOW = new Date("2026-09-23T14:00:00Z");
const period = (key: string) => {
  const r = parsePeriod(new URLSearchParams({ period: key }), NOW);
  if (!r.ok) throw new Error(r.message);
  return r.period;
};
const at = (daysAgo: number, hour = 12) => new Date(NOW.getTime() - daysAgo * 86_400_000 - (14 - hour) * 3_600_000).toISOString();

const order = (o: Partial<DashboardInput["orders"][number]>) => ({
  id: Math.random().toString(36).slice(2),
  total: 10_000,
  channel: "walk_in",
  status: "completed",
  created_at: at(0),
  customer_id: null,
  cashier_id: null,
  discount_amount: 0,
  promo_code: null,
  items: [],
  ...o,
});

const empty = (): DashboardInput => ({
  period: period("7d"),
  now: NOW,
  orders: [],
  previousOrders: [],
  paidCustomerIds: [],
  transactions: [],
  previousTransactions: [],
  products: [],
  stock: [],
  views: [],
  previousViews: [],
  staff: [],
});

describe("buildDashboard with no data (a new live shop)", () => {
  it("shows zeros everywhere, never made-up numbers", () => {
    const d = buildDashboard(empty());
    expect(d.cards).toEqual({
      bank_payouts: { total: 0, change_pct: 0 },
      cash_in_register: { today: 0 },
      repeat_buyers: { pct: 0, repeat: 0, buyers: 0 },
      completed_sales: { pct: 0, paid: 0, total: 0 },
    });
    expect(d.revenue.total).toBe(0);
    expect(d.revenue.series).toHaveLength(7);
    expect(d.revenue.series.every((p) => p.revenue === 0)).toBe(true);
    expect(d.funnel).toEqual({ visits: 0, cart_adds: 0, checkouts: 0, paid: 0, abandoned: 0, conversion_pct: 0 });
    expect(d.visits.total).toBe(0);
    expect(d.profits).toEqual({ best_margin: [], best_sellers: [] });
    expect(d.unsold).toEqual([]);
    expect(d.sizes).toEqual([]);
    expect(d.staff).toEqual([]);
    expect(d.promos).toEqual([]);
  });
});

describe("the four summary cards", () => {
  it("bank payouts are successful card, transfer and terminal payments in the period, against the one before", () => {
    const input = empty();
    input.transactions = [
      { payment_method: "paystack_card", payment_status: "success", amount: 30_000, created_at: at(1) },
      { payment_method: "pos_terminal", payment_status: "success", amount: 20_000, created_at: at(2) },
      { payment_method: "paystack_bank", payment_status: "failed", amount: 99_000, created_at: at(2) },
      { payment_method: "cash", payment_status: "success", amount: 5_000, created_at: at(0) },
    ];
    input.previousTransactions = [{ payment_method: "paystack_card", payment_status: "success", amount: 40_000, created_at: at(9) }];
    expect(buildDashboard(input).cards.bank_payouts).toEqual({ total: 50_000, change_pct: 25 });
  });

  it("cash in register is today's successful cash only", () => {
    const input = empty();
    input.transactions = [
      { payment_method: "cash", payment_status: "success", amount: 5_000, created_at: at(0, 9) },
      { payment_method: "cash", payment_status: "success", amount: 7_000, created_at: at(1) },
      { payment_method: "cash", payment_status: "refunded", amount: 3_000, created_at: at(0, 10) },
    ];
    expect(buildDashboard(input).cards.cash_in_register).toEqual({ today: 5_000 });
  });

  it("repeat buyers are customers with two or more paid orders, out of everyone who has bought", () => {
    const input = empty();
    input.paidCustomerIds = ["a", "a", "b", "c", "c", "c", null];
    expect(buildDashboard(input).cards.repeat_buyers).toEqual({ pct: 66.7, repeat: 2, buyers: 3 });
  });

  it("completed sales are paid orders out of all orders in the period", () => {
    const input = empty();
    input.orders = [order({ status: "completed" }), order({ status: "paid" }), order({ status: "pending_payment" }), order({ status: "cancelled" })];
    expect(buildDashboard(input).cards.completed_sales).toEqual({ pct: 50, paid: 2, total: 4 });
  });
});

describe("revenue", () => {
  it("adds up paid orders by Lagos day and compares with the period before", () => {
    const input = empty();
    input.orders = [order({ total: 10_000, created_at: at(0) }), order({ total: 5_000, created_at: at(0) }), order({ total: 2_000, created_at: at(3) }), order({ total: 99_000, status: "cancelled" })];
    input.previousOrders = [order({ total: 34_000, created_at: at(10) })];
    const d = buildDashboard(input);
    expect(d.revenue.total).toBe(17_000);
    expect(d.revenue.change_pct).toBe(-50);
    expect(d.revenue.series.at(-1)).toMatchObject({ date: "2026-09-23", label: "Wed", revenue: 15_000 });
    expect(d.revenue.series.at(-4)).toMatchObject({ date: "2026-09-20", revenue: 2_000 });
  });

  it("labels the 30-day view by date", () => {
    const input = { ...empty(), period: period("30d") };
    const d = buildDashboard(input);
    expect(d.revenue.series).toHaveLength(30);
    expect(d.revenue.series.at(-1)!.label).toBe("23 Sep");
  });
});

describe("product profits", () => {
  it("ranks margin from each product's own cost and price, skipping products with no cost or not on sale", () => {
    const input = empty();
    input.products = [
      { id: "p1", name: "Jacket", base_price: 64_800, cost_price: 18_000, status: "active", category: { name: "Outerwear" } },
      { id: "p2", name: "Shirt", base_price: 48_000, cost_price: 15_000, status: "active", category: { name: "Shirts" } },
      { id: "p3", name: "No cost", base_price: 10_000, cost_price: null, status: "active", category: null },
      { id: "p4", name: "Draft", base_price: 10_000, cost_price: 1_000, status: "draft", category: null },
    ];
    expect(buildDashboard(input).profits.best_margin).toEqual([
      { id: "p1", name: "Jacket", category: "Outerwear", cost: 18_000, price: 64_800, margin_pct: 72 },
      { id: "p2", name: "Shirt", category: "Shirts", cost: 15_000, price: 48_000, margin_pct: 69 },
    ]);
  });

  it("ranks best sellers by revenue from paid orders in the period", () => {
    const input = empty();
    input.orders = [
      order({ items: [{ quantity: 2, line_total: 20_000, product_snapshot: { id: "p1", name: "Jacket", size: "L" } }, { quantity: 1, line_total: 50_000, product_snapshot: { id: "p2", name: "Shoe", size: "42" } }] }),
      order({ status: "cancelled", items: [{ quantity: 9, line_total: 900_000, product_snapshot: { id: "p3", name: "Cancelled" } }] }),
    ];
    expect(buildDashboard(input).profits.best_sellers.map((p) => [p.name, p.units, p.revenue])).toEqual([["Shoe", 1, 50_000], ["Jacket", 2, 20_000]]);
  });
});

describe("storefront funnel and visits", () => {
  it("counts distinct shopper sessions, carts, checkouts and payments", () => {
    const input = empty();
    input.views = [
      { session_id: "s1", event_type: "view", created_at: at(0) },
      { session_id: "s1", event_type: "cart_add", created_at: at(0) },
      { session_id: "s2", event_type: "view", created_at: at(1) },
      { session_id: "s3", event_type: "view", created_at: at(1) },
      { session_id: "s3", event_type: "cart_add", created_at: at(1) },
      { session_id: null, event_type: "view", created_at: at(1) },
    ];
    input.previousViews = [{ session_id: "old", event_type: "view", created_at: at(9) }, { session_id: "old2", event_type: "view", created_at: at(9) }];
    input.orders = [order({ channel: "online", status: "paid" }), order({ channel: "online", status: "pending_payment" }), order({ channel: "walk_in" })];
    const d = buildDashboard(input);
    expect(d.funnel).toEqual({ visits: 3, cart_adds: 2, checkouts: 2, paid: 1, abandoned: 1, conversion_pct: 33.3 });
    expect(d.visits.total).toBe(3);
    expect(d.visits.change_pct).toBe(50);
    expect(d.visits.series.at(-2)).toMatchObject({ date: "2026-09-22", visits: 2 });
  });
});

describe("inventory, sizes, staff and promos", () => {
  it("lists stock that hasn't sold in the period, most money tied up first", () => {
    const input = empty();
    input.products = [
      { id: "p1", name: "Sold", base_price: 10_000, cost_price: 4_000, status: "active", category: null },
      { id: "p2", name: "Idle coat", base_price: 50_000, cost_price: 20_000, status: "active", category: null },
      { id: "p3", name: "Idle tee", base_price: 8_000, cost_price: null, status: "active", category: null },
      { id: "p4", name: "Empty", base_price: 8_000, cost_price: 1_000, status: "active", category: null },
    ];
    input.stock = [
      { product_id: "p1", quantity: 5, reserved_quantity: 0 },
      { product_id: "p2", quantity: 3, reserved_quantity: 1 },
      { product_id: "p2", quantity: 1, reserved_quantity: 0 },
      { product_id: "p3", quantity: 10, reserved_quantity: 0 },
      { product_id: "p4", quantity: 0, reserved_quantity: 0 },
    ];
    input.orders = [order({ items: [{ quantity: 1, line_total: 10_000, product_snapshot: { id: "p1", name: "Sold" } }] })];
    expect(buildDashboard(input).unsold).toEqual([
      { product_id: "p3", name: "Idle tee", units: 10, value: 80_000 },
      { product_id: "p2", name: "Idle coat", units: 3, value: 60_000 },
    ]);
  });

  it("shares units sold by size", () => {
    const input = empty();
    input.orders = [order({ items: [{ quantity: 3, line_total: 1, product_snapshot: { id: "a", size: "M" } }, { quantity: 1, line_total: 1, product_snapshot: { id: "b", size: "L" } }, { quantity: 1, line_total: 1, product_snapshot: { id: "c" } }] })];
    expect(buildDashboard(input).sizes).toEqual([
      { size: "M", units: 3, share_pct: 60 },
      { size: "L", units: 1, share_pct: 20 },
      { size: "One size", units: 1, share_pct: 20 },
    ]);
  });

  it("totals each cashier's sales and manual discounts, by name", () => {
    const input = empty();
    input.staff = [{ id: "c1", full_name: "Ada" }];
    input.orders = [order({ cashier_id: "c1", total: 9_000, discount_amount: 1_000 }), order({ cashier_id: "c1", total: 5_000 }), order({ cashier_id: "gone", total: 1_000 }), order({ cashier_id: "c1", status: "cancelled", total: 50_000 })];
    expect(buildDashboard(input).staff).toEqual([
      { cashier_id: "c1", name: "Ada", orders: 2, sales: 14_000, discounts: 1_000 },
      { cashier_id: "gone", name: "Former staff", orders: 1, sales: 1_000, discounts: 0 },
    ]);
  });

  it("shows what each promo code brought in and gave away", () => {
    const input = empty();
    input.orders = [order({ promo_code: "SAVE10", total: 9_000, discount_amount: 1_000 }), order({ promo_code: "SAVE10", total: 18_000, discount_amount: 2_000 }), order({ promo_code: "VIP", total: 5_000, discount_amount: 500 })];
    expect(buildDashboard(input).promos).toEqual([
      { code: "SAVE10", uses: 2, revenue: 27_000, discount: 3_000 },
      { code: "VIP", uses: 1, revenue: 5_000, discount: 500 },
    ]);
  });
});
