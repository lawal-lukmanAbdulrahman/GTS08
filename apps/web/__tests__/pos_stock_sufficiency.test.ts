import { describe, it, expect } from "vitest";
import { checkStockSufficiency } from "../app/api/v1/pos/_lib/stock-sufficiency";

describe("checkStockSufficiency (spec Part 8, rule 4: re-validated at order creation)", () => {
  it("is ok when every requested quantity is within what's available", () => {
    const result = checkStockSufficiency(
      [{ variantId: "v1", quantity: 2 }],
      { v1: 5 }
    );
    expect(result.ok).toBe(true);
  });

  it("flags a variant that no longer has enough stock", () => {
    const result = checkStockSufficiency(
      [{ variantId: "v1", quantity: 3 }],
      { v1: 1 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.insufficient).toEqual([{ variantId: "v1", requested: 3, available: 1 }]);
    }
  });

  it("treats a variant missing from the availability map as having zero stock", () => {
    const result = checkStockSufficiency([{ variantId: "ghost", quantity: 1 }], {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.insufficient[0]).toEqual({ variantId: "ghost", requested: 1, available: 0 });
    }
  });

  it("reports every insufficient line, not just the first", () => {
    const result = checkStockSufficiency(
      [
        { variantId: "v1", quantity: 3 },
        { variantId: "v2", quantity: 1 },
      ],
      { v1: 1, v2: 5 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.insufficient).toHaveLength(1);
      expect(result.insufficient[0].variantId).toBe("v1");
    }
  });
});
