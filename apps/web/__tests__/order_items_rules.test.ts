import { describe, it, expect } from "vitest";
import { validateOrderItems, isUuid, MAX_LINE_QUANTITY, MAX_ORDER_LINES } from "@gts/utils";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";

describe("isUuid", () => {
  it("accepts a uuid and rejects everything else", () => {
    expect(isUuid(V1)).toBe(true);
    expect(isUuid("ABCDEF12-1234-4234-8234-123456789ABC")).toBe(true);
    for (const bad of ["abc", "", "x') or 1=1--", "11111111-1111-4111-8111-11111111111", null, undefined, 5, {}]) expect(isUuid(bad)).toBe(false);
  });
});

describe("validateOrderItems", () => {
  it("accepts good lines and returns them clean", () => {
    expect(validateOrderItems([{ variant_id: V1, quantity: 2 }])).toEqual({ ok: true, items: [{ variant_id: V1, quantity: 2 }] });
  });

  it("merges repeated lines for the same variant so stock is checked once for the total", () => {
    const r = validateOrderItems([{ variant_id: V1, quantity: 2 }, { variant_id: V2, quantity: 1 }, { variant_id: V1, quantity: 3 }]);
    expect(r).toEqual({ ok: true, items: [{ variant_id: V1, quantity: 5 }, { variant_id: V2, quantity: 1 }] });
  });

  it.each([
    ["quantity 0", [{ variant_id: V1, quantity: 0 }]],
    ["negative quantity (would ADD stock)", [{ variant_id: V1, quantity: -3 }]],
    ["fractional quantity", [{ variant_id: V1, quantity: 1.5 }]],
    ["string quantity", [{ variant_id: V1, quantity: "2" }]],
    ["NaN quantity", [{ variant_id: V1, quantity: NaN }]],
    ["Infinity quantity", [{ variant_id: V1, quantity: Infinity }]],
    ["missing quantity", [{ variant_id: V1 }]],
    ["quantity above the cap", [{ variant_id: V1, quantity: MAX_LINE_QUANTITY + 1 }]],
    ["non-uuid variant", [{ variant_id: "abc", quantity: 1 }]],
    ["missing variant", [{ quantity: 1 }]],
    ["a line that isn't an object", ["x"]],
    ["null line", [null]],
  ])("rejects %s", (_n, items) => {
    const r = validateOrderItems(items);
    expect(r.ok).toBe(false);
  });

  it("rejects a merged total above the cap", () => {
    const half = Math.floor(MAX_LINE_QUANTITY / 2) + 1;
    expect(validateOrderItems([{ variant_id: V1, quantity: half }, { variant_id: V1, quantity: half }]).ok).toBe(false);
  });

  it("rejects too many lines", () => {
    const many = Array.from({ length: MAX_ORDER_LINES + 1 }, (_, i) => ({ variant_id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`, quantity: 1 }));
    expect(validateOrderItems(many).ok).toBe(false);
  });

  it("rejects a non-array", () => {
    for (const bad of [undefined, null, "x", 5, {}]) expect(validateOrderItems(bad).ok).toBe(false);
  });

  it("names the offending line in the error", () => {
    const r = validateOrderItems([{ variant_id: V1, quantity: 1 }, { variant_id: V2, quantity: 0 }]);
    expect(!r.ok && r.message).toMatch(/item 2/i);
  });
});
