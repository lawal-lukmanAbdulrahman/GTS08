import { describe, it, expect } from "vitest";
import { describeDiscount, describeUse, promoStatus, buildPromoBody } from "./promo-form";

const P = { code: "WELCOME10", discount_type: "percentage" as const, discount_value: 10, min_order_amount: 0, max_uses: null, used_count: 3, starts_at: "2020-01-01T00:00:00Z", expires_at: null, is_active: true };
const NOW = new Date("2026-09-20T10:00:00Z");

describe("promo display helpers", () => {
  it("describes the discount in plain words", () => {
    expect(describeDiscount(P)).toBe("10% off");
    expect(describeDiscount({ ...P, discount_type: "fixed_amount", discount_value: 500000 })).toBe("₦5,000 off");
    expect(describeDiscount({ ...P, min_order_amount: 2000000 })).toBe("10% off orders over ₦20,000");
  });
  it("describes how much a code has been used", () => {
    expect(describeUse(P)).toBe("3 used");
    expect(describeUse({ ...P, max_uses: 50 })).toBe("3 of 50 used");
  });
  it("says whether a code works right now", () => {
    expect(promoStatus(P, NOW)).toBe("Live");
    expect(promoStatus({ ...P, is_active: false }, NOW)).toBe("Off");
    expect(promoStatus({ ...P, expires_at: "2026-09-01T00:00:00Z" }, NOW)).toBe("Expired");
    expect(promoStatus({ ...P, starts_at: "2026-12-01T00:00:00Z" }, NOW)).toBe("Not started");
    expect(promoStatus({ ...P, max_uses: 3 }, NOW)).toBe("Used up");
  });
});

describe("buildPromoBody (what the form sends)", () => {
  const base = { code: " welcome10 ", type: "percentage" as const, value: "10", minOrder: "", maxUses: "", expires: "" };
  it("sends a percentage as is, and naira as kobo", () => {
    expect(buildPromoBody(base)).toEqual({ ok: true, body: { code: "welcome10", discount_type: "percentage", discount_value: 10 } });
    expect(buildPromoBody({ ...base, type: "fixed_amount", value: "5,000", minOrder: "20000", maxUses: "50", expires: "2026-12-31" })).toEqual({
      ok: true,
      body: { code: "welcome10", discount_type: "fixed_amount", discount_value: 500000, min_order_amount: 2000000, max_uses: 50, expires_at: "2026-12-31T22:59:59.000Z" },
    });
  });
  it("says what's wrong, field by field", () => {
    const r = buildPromoBody({ code: "", type: "percentage", value: "abc", minOrder: "x", maxUses: "0", expires: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["code", "expires", "maxUses", "minOrder", "value"]);
  });
});
