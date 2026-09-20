import { describe, it, expect } from "vitest";
import { resolveManualDiscount } from "./manual-discount-input";

const cashier = { subtotal: 3000000, isAdmin: false, canApply: true }; // ₦30,000

describe("resolveManualDiscount (what the cashier typed -> kobo, or why not)", () => {
  it("is no discount when nothing is typed", () => {
    expect(resolveManualDiscount("", cashier)).toEqual({ kobo: 0, error: null });
    expect(resolveManualDiscount("   ", cashier)).toEqual({ kobo: 0, error: null });
  });

  it("turns a valid amount into exact kobo", () => {
    expect(resolveManualDiscount("3,000", cashier)).toEqual({ kobo: 300000, error: null });
    expect(resolveManualDiscount("19.99", cashier)).toEqual({ kobo: 1999, error: null });
  });

  it("explains an amount it can't read", () => {
    const r = resolveManualDiscount("abc", cashier);
    expect(r.kobo).toBe(0);
    expect(r.error).toMatch(/valid amount/i);
  });

  it("caps a cashier at 20% and says what the most is", () => {
    expect(resolveManualDiscount("6,000", cashier)).toEqual({ kobo: 600000, error: null });
    const r = resolveManualDiscount("6,000.01", cashier);
    expect(r.kobo).toBe(0);
    expect(r.error).toMatch(/above 20%.*₦6,000/i);
  });

  it("refuses more than the whole subtotal", () => {
    const r = resolveManualDiscount("40,000", { ...cashier, isAdmin: true });
    expect(r.error).toMatch(/more than the order subtotal/i);
  });

  it("lets an admin go above 20%", () => {
    expect(resolveManualDiscount("25,000", { ...cashier, isAdmin: true })).toEqual({ kobo: 2500000, error: null });
  });

  it("refuses a cashier who hasn't been granted discounts", () => {
    const r = resolveManualDiscount("100", { ...cashier, canApply: false });
    expect(r.error).toMatch(/permission/i);
  });

  it("treats zero as no discount", () => {
    expect(resolveManualDiscount("0", { ...cashier, canApply: false })).toEqual({ kobo: 0, error: null });
  });
});
