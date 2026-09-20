import { describe, it, expect } from "vitest";
import { parsePeriod, summarize, dailySeries, pctChange, rankProducts, PAID_STATUSES } from "../app/api/v1/_lib/analytics";

const NOW = new Date("2026-09-20T10:30:00Z"); // 11:30 in Lagos, Sunday

const q = (s: string) => new URLSearchParams(s);

describe("parsePeriod", () => {
  it("defaults to the last 7 Lagos days, ending now, with an equal earlier period to compare against", () => {
    const r = parsePeriod(q(""), NOW);
    expect(r.ok && r.period.key).toBe("7d");
    if (!r.ok) throw new Error();
    expect(r.period.from.toISOString()).toBe("2026-09-13T23:00:00.000Z"); // 00:00 Lagos on the 14th
    expect(r.period.to).toEqual(NOW);
    expect(r.period.to.getTime() - r.period.from.getTime()).toBe(r.period.prevTo.getTime() - r.period.prevFrom.getTime());
    expect(r.period.prevTo.getTime()).toBe(r.period.from.getTime());
  });
  it("understands today and 30d", () => {
    const today = parsePeriod(q("period=today"), NOW);
    if (!today.ok) throw new Error();
    expect(today.period.from.toISOString()).toBe("2026-09-19T23:00:00.000Z");
    const d30 = parsePeriod(q("period=30d"), NOW);
    if (!d30.ok) throw new Error();
    expect(d30.period.from.toISOString()).toBe("2026-08-21T23:00:00.000Z");
  });
  it("takes a custom range of dates, inclusive of the last day", () => {
    const r = parsePeriod(q("period=custom&from=2026-09-01&to=2026-09-03"), NOW);
    if (!r.ok) throw new Error();
    expect(r.period.from.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(r.period.to.toISOString()).toBe("2026-09-03T23:00:00.000Z");
  });
  it("rejects nonsense, backwards and over-long ranges", () => {
    for (const s of ["period=year", "period=custom", "period=custom&from=x&to=y", "period=custom&from=2026-09-05&to=2026-09-01", "period=custom&from=2020-01-01&to=2026-01-01", "from=2026-09-01&to=2026-13-40"]) {
      expect(parsePeriod(q(s), NOW).ok, s).toBe(false);
    }
  });
  it("accepts from/to alone as a custom range (the sales endpoint's form)", () => {
    expect(parsePeriod(q("from=2026-09-01&to=2026-09-03"), NOW).ok).toBe(true);
  });
});

const o = (total: number, channel: string, created_at: string) => ({ total, channel, created_at });

describe("summarize", () => {
  const orders = [o(1000, "online", "2026-09-20T09:00:00Z"), o(500, "walk_in", "2026-09-20T09:30:00Z"), o(300, "whatsapp", "2026-09-19T09:30:00Z"), o(200, "online", "2026-09-19T09:30:00Z")];
  it("splits revenue and orders by channel", () => {
    expect(summarize(orders)).toEqual({
      revenue: { total: 2000, online: 1200, walkin: 500, whatsapp: 300 },
      orders: { total: 4, online: 2, walkin: 1, whatsapp: 1 },
      average_order_value: 500,
    });
  });
  it("is all zeros, with no divide-by-zero, when there are no orders", () => {
    expect(summarize([])).toEqual({ revenue: { total: 0, online: 0, walkin: 0, whatsapp: 0 }, orders: { total: 0, online: 0, walkin: 0, whatsapp: 0 }, average_order_value: 0 });
  });
  it("rounds the average to a whole kobo", () => {
    expect(summarize([o(100, "online", "x"), o(101, "online", "x")]).average_order_value).toBe(101);
  });
});

describe("pctChange", () => {
  it("is the change against the earlier period, to one decimal", () => {
    expect(pctChange(1125, 1000)).toBe(12.5);
    expect(pctChange(500, 1000)).toBe(-50);
  });
  it("has no percentage when there was nothing before", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
});

describe("dailySeries", () => {
  it("gives one row per Lagos day, including days with no sales, in order", () => {
    const from = new Date("2026-09-17T23:00:00Z"); // 18th 00:00 Lagos
    const to = new Date("2026-09-20T10:30:00Z");
    const rows = dailySeries([o(1000, "online", "2026-09-20T09:00:00Z"), o(500, "online", "2026-09-19T22:30:00Z") /* 23:30 Lagos on the 19th */, o(300, "walk_in", "2026-09-19T23:30:00Z") /* 00:30 Lagos on the 20th */], from, to);
    expect(rows).toEqual([
      { date: "2026-09-18", revenue: 0, orders: 0 },
      { date: "2026-09-19", revenue: 500, orders: 1 },
      { date: "2026-09-20", revenue: 1300, orders: 2 },
    ]);
  });
});

describe("rankProducts", () => {
  it("adds up units and revenue per product and returns the best sellers first", () => {
    const lines = [
      { quantity: 2, line_total: 200, product_snapshot: { id: "a", name: "A" } },
      { quantity: 5, line_total: 500, product_snapshot: { id: "b", name: "B" } },
      { quantity: 1, line_total: 100, product_snapshot: { id: "a", name: "A" } },
      { quantity: 1, line_total: 50, product_snapshot: null },
    ];
    expect(rankProducts(lines, 2)).toEqual([
      { product_id: "b", name: "B", units: 5, revenue: 500 },
      { product_id: "a", name: "A", units: 3, revenue: 300 },
    ]);
  });
});

describe("PAID_STATUSES", () => {
  it("counts money actually received, never cancelled, voided or unpaid orders", () => {
    for (const s of ["pending_payment", "cancelled", "voided"]) expect(PAID_STATUSES).not.toContain(s);
    for (const s of ["paid", "completed", "delivered"]) expect(PAID_STATUSES).toContain(s);
  });
});
