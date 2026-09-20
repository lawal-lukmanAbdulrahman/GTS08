import { describe, it, expect } from "vitest";
import { startOfWATDay, rangeStart } from "@gts/utils";
import { summariseSales, type SaleRow } from "../app/api/v1/_lib/sales-summary";

describe("startOfWATDay (Lagos is UTC+1, no daylight saving)", () => {
  it("starts the day at 23:00 UTC the evening before", () => {
    expect(startOfWATDay(new Date("2026-09-19T10:30:00Z")).toISOString()).toBe("2026-09-18T23:00:00.000Z");
  });

  it("counts 23:30 UTC as already tomorrow in Lagos", () => {
    expect(startOfWATDay(new Date("2026-09-18T23:30:00Z")).toISOString()).toBe("2026-09-18T23:00:00.000Z");
  });

  it("counts 22:59 UTC as still today in Lagos", () => {
    expect(startOfWATDay(new Date("2026-09-18T22:59:00Z")).toISOString()).toBe("2026-09-17T23:00:00.000Z");
  });
});

describe("rangeStart", () => {
  const now = new Date("2026-09-19T10:30:00Z");
  it("today = the start of today in Lagos", () => {
    expect(rangeStart("today", now).toISOString()).toBe("2026-09-18T23:00:00.000Z");
  });
  it("week = today plus the six days before it", () => {
    expect(rangeStart("week", now).toISOString()).toBe("2026-09-12T23:00:00.000Z");
  });
  it("month = today plus the twenty-nine days before it", () => {
    expect(rangeStart("month", now).toISOString()).toBe("2026-08-20T23:00:00.000Z");
  });
});

type SaleOverrides = Partial<Omit<SaleRow, "order">> & { order?: Partial<SaleRow["order"]> };
const sale = (over: SaleOverrides = {}): SaleRow => ({
  amount: 1000000,
  payment_method: "cash",
  created_at: "2026-09-19T09:00:00Z",
  ...over,
  order: { order_number: "GTS-1", channel: "walk_in", status: "completed", discount_amount: 0, ...over.order },
});

describe("summariseSales (a staff member's record)", () => {
  it("is all zeros with no sales", () => {
    expect(summariseSales([])).toEqual({
      sales: { count: 0, total: 0, average: 0 },
      by_payment_method: { cash: { count: 0, total: 0 }, pos_terminal: { count: 0, total: 0 } },
      by_channel: { walk_in: { count: 0, total: 0 }, whatsapp: { count: 0, total: 0 } },
      voided: { count: 0, total: 0 },
      discounts_given: { count: 0, total: 0 },
    });
  });

  it("totals completed sales and splits them by payment method and channel", () => {
    const s = summariseSales([
      sale({ amount: 1000000, payment_method: "cash" }),
      sale({ amount: 2500000, payment_method: "pos_terminal", order: { channel: "whatsapp", order_number: "GTS-2" } }),
      sale({ amount: 500000, payment_method: "cash" }),
    ]);
    expect(s.sales).toEqual({ count: 3, total: 4000000, average: 1333333 });
    expect(s.by_payment_method).toEqual({ cash: { count: 2, total: 1500000 }, pos_terminal: { count: 1, total: 2500000 } });
    expect(s.by_channel).toEqual({ walk_in: { count: 2, total: 1500000 }, whatsapp: { count: 1, total: 2500000 } });
  });

  it("keeps voided sales out of the sales total and reports them separately", () => {
    const s = summariseSales([
      sale({ amount: 1000000 }),
      sale({ amount: 700000, order: { status: "voided", order_number: "GTS-9" } }),
    ]);
    expect(s.sales).toMatchObject({ count: 1, total: 1000000 });
    expect(s.voided).toEqual({ count: 1, total: 700000 });
    expect(s.by_payment_method.cash).toEqual({ count: 1, total: 1000000 });
  });

  it("totals the discounts given on completed sales", () => {
    const s = summariseSales([
      sale({ order: { discount_amount: 150000 } }),
      sale({ order: { discount_amount: 0 } }),
      sale({ order: { discount_amount: 50000 } }),
    ]);
    expect(s.discounts_given).toEqual({ count: 2, total: 200000 });
  });

  it("rounds the average to a whole kobo", () => {
    expect(summariseSales([sale({ amount: 100 }), sale({ amount: 101 })]).sales.average).toBe(101);
  });

  it("ignores payments that aren't a completed or voided sale (e.g. a cancelled order)", () => {
    const s = summariseSales([sale({ order: { status: "cancelled" } })]);
    expect(s.sales.count).toBe(0);
    expect(s.voided.count).toBe(0);
  });
});
