import { describe, it, expect } from "vitest";
import { computeCartTotals, type PosCartLine } from "@gts/utils";

describe("computeCartTotals (POS, all amounts in kobo)", () => {
  it("sums line totals into a subtotal", () => {
    const lines: PosCartLine[] = [
      { unitPrice: 1500000, quantity: 2 }, // ₦15,000 x 2
      { unitPrice: 850000, quantity: 1 },
    ];
    const totals = computeCartTotals(lines, 0);
    expect(totals.subtotal).toBe(1500000 * 2 + 850000);
    expect(totals.discountAmount).toBe(0);
    expect(totals.total).toBe(totals.subtotal);
  });

  it("subtracts a flat discount from the subtotal", () => {
    const lines: PosCartLine[] = [{ unitPrice: 3000000, quantity: 1 }];
    const totals = computeCartTotals(lines, 300000);
    expect(totals.subtotal).toBe(3000000);
    expect(totals.discountAmount).toBe(300000);
    expect(totals.total).toBe(2700000);
  });

  it("never lets total go below zero even if discount exceeds subtotal", () => {
    const lines: PosCartLine[] = [{ unitPrice: 100000, quantity: 1 }];
    const totals = computeCartTotals(lines, 999999);
    expect(totals.total).toBe(0);
  });

  it("throws on an empty cart", () => {
    expect(() => computeCartTotals([], 0)).toThrow(/empty/i);
  });

  it("throws on a non-integer or non-positive quantity", () => {
    expect(() => computeCartTotals([{ unitPrice: 1000, quantity: 0 }], 0)).toThrow();
    expect(() => computeCartTotals([{ unitPrice: 1000, quantity: 1.5 }], 0)).toThrow();
  });

  it("throws on a negative unit price", () => {
    expect(() => computeCartTotals([{ unitPrice: -100, quantity: 1 }], 0)).toThrow();
  });
});
