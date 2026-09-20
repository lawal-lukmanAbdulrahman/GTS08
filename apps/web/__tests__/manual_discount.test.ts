import { describe, it, expect } from "vitest";
import { checkManualDiscount, MAX_CASHIER_DISCOUNT_PERCENT } from "@gts/utils";

const cashier = { isAdmin: false, canApply: true };

describe("checkManualDiscount (cashier spec Part 4.2)", () => {
  it("caps a cashier at 20% of the subtotal", () => {
    expect(MAX_CASHIER_DISCOUNT_PERCENT).toBe(20);
  });

  it("allows no discount without needing any permission", () => {
    expect(checkManualDiscount({ amount: 0, subtotal: 1000000, isAdmin: false, canApply: false })).toEqual({ ok: true });
  });

  it("refuses a cashier who hasn't been granted discounts", () => {
    const r = checkManualDiscount({ amount: 1000, subtotal: 1000000, isAdmin: false, canApply: false });
    expect(r).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
  });

  it("allows a permitted cashier up to exactly 20%", () => {
    expect(checkManualDiscount({ amount: 200000, subtotal: 1000000, ...cashier })).toEqual({ ok: true });
  });

  it("refuses a cashier one kobo over 20% and says what the limit is", () => {
    const r = checkManualDiscount({ amount: 200001, subtotal: 1000000, ...cashier });
    expect(r).toMatchObject({ ok: false, code: "DISCOUNT_LIMIT_EXCEEDED", maxAmount: 200000 });
  });

  it("rounds the limit down so it never exceeds 20%", () => {
    const r = checkManualDiscount({ amount: 34, subtotal: 169, ...cashier });
    expect(r).toMatchObject({ ok: false, maxAmount: 33 }); // floor(169 * 0.2) = 33
  });

  it("lets an admin discount above 20%, and without a flag", () => {
    expect(checkManualDiscount({ amount: 900000, subtotal: 1000000, isAdmin: true, canApply: false })).toEqual({ ok: true });
  });

  it("never lets anyone discount more than the whole subtotal", () => {
    const r = checkManualDiscount({ amount: 1000001, subtotal: 1000000, isAdmin: true, canApply: true });
    expect(r).toMatchObject({ ok: false, code: "INVALID_DISCOUNT" });
  });

  it.each([-1, 1.5, NaN, Infinity, "500", null])("rejects a discount that isn't a whole non-negative kobo amount: %s", (amount) => {
    const r = checkManualDiscount({ amount: amount as never, subtotal: 1000000, isAdmin: true, canApply: true });
    expect(r).toMatchObject({ ok: false, code: "INVALID_DISCOUNT" });
  });
});
