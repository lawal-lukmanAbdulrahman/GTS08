import { describe, it, expect, beforeEach, vi } from "vitest";
import { percentToNairaText } from "./manual-discount-input";
import { looksLikeSku, skuLookupToProduct } from "./sku-scan";
import { clearHeldSales, discardHeldSale, holdSale, loadHeldSales, MAX_HELD_SALES } from "./held-sales";
import type { CartLine } from "./pos-types";

describe("percentToNairaText (the discount chips)", () => {
  it("turns a percentage of the subtotal into the exact Naira text the box accepts", () => {
    expect(percentToNairaText(3000000, 10)).toBe("3000"); // ₦30,000 -> ₦3,000
    expect(percentToNairaText(3000000, 20)).toBe("6000");
  });
  it("keeps kobo when the amount isn't whole naira, rounding down (never above the percentage)", () => {
    expect(percentToNairaText(1999900, 10)).toBe("1999.9"); // 199,990 kobo
    expect(percentToNairaText(333, 10)).toBe("0.33"); // 33.3 kobo -> 33
    expect(percentToNairaText(10001, 5)).toBe("5"); // 500.05 kobo -> 500
  });
  it("is empty when there is nothing to discount", () => {
    expect(percentToNairaText(0, 10)).toBe("");
    expect(percentToNairaText(1, 10)).toBe("");
  });
  it("round-trips through the parser to the same kobo", async () => {
    const { parseNairaInput } = await import("@gts/utils");
    for (const [sub, pct] of [[3000000, 10], [1999900, 10], [123457, 7], [999999, 20]] as const) {
      expect(parseNairaInput(percentToNairaText(sub, pct))).toBe(Math.floor((sub * pct) / 100));
    }
  });
});

describe("looksLikeSku", () => {
  it.each([["GTS-SHIRT-M-BLK", true], ["G-PX10-PRO-MET-128GB", true], ["abc123", true], ["shirt", false], ["red shirt", false], ["", false], ["ab", false], ["x'); drop", false], ["a".repeat(80), false]])("%s -> %s", (t, want) => {
    expect(looksLikeSku(t)).toBe(want);
  });
});

describe("skuLookupToProduct", () => {
  const data = {
    product: { id: "p1", name: "Oxford Shirt", slug: "oxford", base_price: 1500000 },
    variant: { id: "v1", size: "L", color: "Black", color_hex: "#000", sku: "GTS-OX-L", price_modifier: 100000, quantity: 5, available: 3 },
  };
  it("builds a product the cart can add from", () => {
    const p = skuLookupToProduct(data);
    expect(p.id).toBe("p1");
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0]!.id).toBe("v1");
    expect(p.base_price).toBe(1500000);
  });
  it("marks stock status from availability", () => {
    expect(skuLookupToProduct(data).stock_status).toBe("in_stock");
    expect(skuLookupToProduct({ ...data, variant: { ...data.variant, available: 0 } }).stock_status).toBe("out_of_stock");
  });
});

const LINE: CartLine = { variantId: "v1", productId: "p1", productName: "Shirt", size: null, color: null, unitPrice: 1000, quantity: 2, available: 5 };

describe("held sales (park a cart while serving someone else)", () => {
  beforeEach(() => localStorage.clear());

  it("holds a sale and lists it, newest first", () => {
    holdSale("staff-1", { lines: [LINE], discountText: "100" });
    holdSale("staff-1", { lines: [{ ...LINE, quantity: 1 }], discountText: "" });
    const held = loadHeldSales("staff-1");
    expect(held).toHaveLength(2);
    expect(held[0]!.lines[0]!.quantity).toBe(1);
    expect(held[1]!.discountText).toBe("100");
    expect(new Set(held.map((h) => h.id)).size).toBe(2);
  });

  it("never holds an empty cart", () => {
    expect(holdSale("staff-1", { lines: [], discountText: "" })).toBeNull();
    expect(loadHeldSales("staff-1")).toEqual([]);
  });

  it("keeps each staff member's held sales separate", () => {
    holdSale("staff-1", { lines: [LINE], discountText: "" });
    expect(loadHeldSales("staff-2")).toEqual([]);
  });

  it("discards one", () => {
    const a = holdSale("staff-1", { lines: [LINE], discountText: "" })!;
    holdSale("staff-1", { lines: [LINE], discountText: "" });
    discardHeldSale("staff-1", a.id);
    expect(loadHeldSales("staff-1").some((h) => h.id === a.id)).toBe(false);
    expect(loadHeldSales("staff-1")).toHaveLength(1);
  });

  it("caps how many can be parked (oldest dropped)", () => {
    for (let i = 0; i < MAX_HELD_SALES + 3; i++) holdSale("s", { lines: [{ ...LINE, quantity: i + 1 }], discountText: "" });
    const held = loadHeldSales("s");
    expect(held).toHaveLength(MAX_HELD_SALES);
    expect(held[0]!.lines[0]!.quantity).toBe(MAX_HELD_SALES + 3);
  });

  it("clears everything at sign-out", () => {
    holdSale("staff-1", { lines: [LINE], discountText: "" });
    holdSale("staff-2", { lines: [LINE], discountText: "" });
    clearHeldSales();
    expect(loadHeldSales("staff-1")).toEqual([]);
    expect(loadHeldSales("staff-2")).toEqual([]);
  });

  it("survives blocked or corrupt storage", () => {
    localStorage.setItem("gts_held_sales:s", "{not json");
    expect(loadHeldSales("s")).toEqual([]);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(holdSale("s", { lines: [LINE], discountText: "" })).toBeNull();
    spy.mockRestore();
  });

  it("ignores stored rows that aren't shaped like a held sale", () => {
    localStorage.setItem("gts_held_sales:s", JSON.stringify([{ id: 1 }, null, "x", { id: "ok", heldAt: "2026-01-01T00:00:00Z", lines: [LINE], discountText: "" }]));
    expect(loadHeldSales("s").map((h) => h.id)).toEqual(["ok"]);
  });
});
