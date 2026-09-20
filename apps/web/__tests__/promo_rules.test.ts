import { describe, it, expect } from "vitest";
import { normalizePromoCode, computePromoDiscount, validatePromoInput } from "@gts/utils";

const NOW = new Date("2026-09-20T10:00:00Z");
const promo = (over: Record<string, unknown> = {}) => ({ code: "WELCOME10", discount_type: "percentage" as const, discount_value: 10, min_order_amount: 0, max_uses: null, used_count: 0, starts_at: "2026-09-01T00:00:00Z", expires_at: null, is_active: true, ...over });

describe("normalizePromoCode", () => {
  it("trims and upper-cases, and refuses anything that isn't a plain code", () => {
    expect(normalizePromoCode("  welcome10 ")).toBe("WELCOME10");
    expect(normalizePromoCode("SUMMER-20_x")).toBe("SUMMER-20_X");
    for (const bad of ["", "ab", "a b c", "x".repeat(51), "code;drop", "😀😀😀", 5, null]) expect(normalizePromoCode(bad as never), String(bad)).toBeNull();
  });
});

describe("computePromoDiscount", () => {
  it("takes a percentage off the subtotal, rounded down to a whole kobo", () => {
    expect(computePromoDiscount(promo(), 1999999, NOW)).toEqual({ ok: true, discount: 199999 });
  });
  it("takes a fixed amount, but never more than the subtotal", () => {
    expect(computePromoDiscount(promo({ discount_type: "fixed_amount", discount_value: 500000 }), 3000000, NOW)).toEqual({ ok: true, discount: 500000 });
    expect(computePromoDiscount(promo({ discount_type: "fixed_amount", discount_value: 500000 }), 200000, NOW)).toEqual({ ok: true, discount: 200000 });
  });
  it("refuses an inactive, not-yet-started, expired or used-up code, all with the same answer", () => {
    for (const over of [{ is_active: false }, { starts_at: "2026-10-01T00:00:00Z" }, { expires_at: "2026-09-19T00:00:00Z" }, { max_uses: 5, used_count: 5 }]) {
      expect(computePromoDiscount(promo(over), 1000000, NOW), JSON.stringify(over)).toEqual({ ok: false, reason: "INVALID_PROMO" });
    }
  });
  it("says how much more to spend when the minimum isn't met", () => {
    expect(computePromoDiscount(promo({ min_order_amount: 2000000 }), 1500000, NOW)).toEqual({ ok: false, reason: "MIN_ORDER", shortBy: 500000 });
  });
  it("accepts a code up to the last moment and while uses remain", () => {
    expect(computePromoDiscount(promo({ expires_at: "2026-09-20T10:00:01Z", max_uses: 5, used_count: 4 }), 1000000, NOW).ok).toBe(true);
  });
  it("gives no discount on an empty subtotal", () => {
    expect(computePromoDiscount(promo(), 0, NOW)).toEqual({ ok: false, reason: "INVALID_PROMO" });
  });
});

describe("validatePromoInput", () => {
  const ok = (o: unknown) => { const r = validatePromoInput(o, "create"); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.value; };
  const errs = (o: unknown, mode: "create" | "update" = "create") => { const r = validatePromoInput(o, mode); return r.ok ? null : r.errors; };
  const base = { code: "welcome10", discount_type: "percentage", discount_value: 10 };

  it("accepts a minimal percentage code and normalises it", () => {
    expect(ok(base)).toMatchObject({ code: "WELCOME10", discount_type: "percentage", discount_value: 10 });
  });
  it("accepts every field", () => {
    expect(ok({ ...base, min_order_amount: 500000, max_uses: 100, starts_at: "2026-09-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", is_active: false })).toMatchObject({ max_uses: 100, is_active: false, expires_at: "2026-12-01T00:00:00.000Z" });
  });
  it("keeps percentages within 1 to 100 and amounts whole and positive", () => {
    for (const v of [0, 101, 1.5, -5, "10"]) expect(errs({ ...base, discount_value: v })?.discount_value, String(v)).toBeTruthy();
    expect(errs({ code: "FLAT", discount_type: "fixed_amount", discount_value: 0 })?.discount_value).toBeTruthy();
    expect(errs({ code: "FLAT", discount_type: "fixed_amount", discount_value: 2_000_000_000 })?.discount_value).toBeTruthy();
  });
  it("rejects a bad code, type, limits and dates", () => {
    expect(errs({ ...base, code: "a b" })?.code).toBeTruthy();
    expect(errs({ ...base, discount_type: "bogus" })?.discount_type).toBeTruthy();
    expect(errs({ ...base, max_uses: 0 })?.max_uses).toBeTruthy();
    expect(errs({ ...base, min_order_amount: -1 })?.min_order_amount).toBeTruthy();
    expect(errs({ ...base, starts_at: "not a date" })?.starts_at).toBeTruthy();
    expect(errs({ ...base, starts_at: "2026-10-01T00:00:00Z", expires_at: "2026-09-01T00:00:00Z" })?.expires_at).toBeTruthy();
  });
  it("on create needs a code, a type and a value; on update only the fields sent, and never the use count", () => {
    expect(errs({}, "create")).toMatchObject({ code: expect.any(String), discount_type: expect.any(String), discount_value: expect.any(String) });
    const r = validatePromoInput({ is_active: false, used_count: 99, id: "x" }, "update");
    expect(r.ok && r.value).toEqual({ is_active: false });
    expect(errs({}, "update")).toEqual({ _body: expect.any(String) });
  });
  it("treats an unlimited or open-ended field as null", () => {
    expect(ok({ ...base, max_uses: null, expires_at: null })).toMatchObject({ max_uses: null, expires_at: null });
  });
});
