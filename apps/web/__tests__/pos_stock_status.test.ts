import { describe, it, expect } from "vitest";
import { computeStockStatus, variantAvailable } from "../app/api/v1/pos/_lib/stock-status";

describe("variantAvailable", () => {
  it("subtracts reserved_quantity from quantity", () => {
    expect(variantAvailable({ quantity: 10, reserved_quantity: 3 })).toBe(7);
  });

  it("never goes negative", () => {
    expect(variantAvailable({ quantity: 2, reserved_quantity: 5 })).toBe(0);
  });
});

describe("computeStockStatus (product card badge, spec Part 3.3)", () => {
  it("is out_of_stock when every variant has 0 available", () => {
    const status = computeStockStatus([
      { quantity: 0, reserved_quantity: 0, low_stock_threshold: 5 },
      { quantity: 3, reserved_quantity: 3, low_stock_threshold: 5 },
    ]);
    expect(status).toBe("out_of_stock");
  });

  it("is low_stock when total available is at or below the threshold but > 0", () => {
    const status = computeStockStatus([
      { quantity: 5, reserved_quantity: 2, low_stock_threshold: 5 },
    ]);
    expect(status).toBe("low_stock");
  });

  it("is in_stock when total available is above the threshold", () => {
    const status = computeStockStatus([
      { quantity: 50, reserved_quantity: 0, low_stock_threshold: 5 },
    ]);
    expect(status).toBe("in_stock");
  });

  it("treats a product with no variants/inventory rows as out_of_stock", () => {
    expect(computeStockStatus([])).toBe("out_of_stock");
  });
});
