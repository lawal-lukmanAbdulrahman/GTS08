import { describe, it, expect } from "vitest";
import { validateProductFlag, validateFlagUpdate, FLAG_REASONS, FLAG_REASON_LABELS, FLAG_STATUSES } from "@gts/utils";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";

function ok(input: unknown) {
  const r = validateProductFlag(input);
  if (!r.ok) throw new Error("expected ok: " + JSON.stringify(r.errors));
  return r.value;
}
function errors(input: unknown) {
  const r = validateProductFlag(input);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

describe("validateProductFlag", () => {
  it("offers the reasons cashiers raise, each with a label", () => {
    expect(FLAG_REASONS).toEqual(["wrong_price", "wrong_stock", "damaged", "missing_image", "barcode_issue", "other"]);
    for (const r of FLAG_REASONS) expect(FLAG_REASON_LABELS[r]).toBeTruthy();
  });

  it("accepts a flag on a product", () => {
    expect(ok({ product_id: PRODUCT, reason: "wrong_price" })).toEqual({ product_id: PRODUCT, variant_id: null, reason: "wrong_price", note: null });
  });

  it("accepts a specific variant and a note, tidying the note", () => {
    expect(ok({ product_id: PRODUCT, variant_id: VARIANT, reason: "damaged", note: "  Box\ncrushed,   screen cracked  " })).toEqual({
      product_id: PRODUCT,
      variant_id: VARIANT,
      reason: "damaged",
      note: "Box crushed, screen cracked",
    });
  });

  it("requires a real product id", () => {
    expect(errors({ reason: "other" }).product_id).toBeDefined();
    expect(errors({ product_id: "not-a-uuid", reason: "other" }).product_id).toBeDefined();
  });

  it("requires a known reason", () => {
    expect(errors({ product_id: PRODUCT }).reason).toBeDefined();
    expect(errors({ product_id: PRODUCT, reason: "because" }).reason).toBeDefined();
  });

  it("insists on a note when the reason is 'other', since there's nothing else to go on", () => {
    expect(errors({ product_id: PRODUCT, reason: "other" }).note).toBeDefined();
    expect(errors({ product_id: PRODUCT, reason: "other", note: "   " }).note).toBeDefined();
    expect(ok({ product_id: PRODUCT, reason: "other", note: "Smells of smoke" }).note).toBe("Smells of smoke");
  });

  it("limits the note to 500 characters", () => {
    expect(errors({ product_id: PRODUCT, reason: "damaged", note: "x".repeat(501) }).note).toBeDefined();
    expect(ok({ product_id: PRODUCT, reason: "damaged", note: "x".repeat(500) }).note).toHaveLength(500);
  });

  it("rejects a malformed variant id", () => {
    expect(errors({ product_id: PRODUCT, variant_id: "nope", reason: "damaged" }).variant_id).toBeDefined();
  });

  it("rejects non-text values and non-objects", () => {
    expect(errors({ product_id: PRODUCT, reason: "damaged", note: 5 }).note).toBeDefined();
    expect(errors("hello")._body).toBeDefined();
    expect(errors(null)._body).toBeDefined();
  });

  it("reports every problem at once", () => {
    expect(Object.keys(errors({ product_id: "x", reason: "y" })).sort()).toEqual(["product_id", "reason"]);
  });
});

describe("validateFlagUpdate (admin review)", () => {
  it("knows the four statuses", () => {
    expect(FLAG_STATUSES).toEqual(["open", "in_review", "resolved", "dismissed"]);
  });

  it("moves a flag into review without needing a note", () => {
    expect(validateFlagUpdate({ status: "in_review" })).toEqual({ ok: true, value: { status: "in_review", resolution_note: null } });
  });

  it("needs a note to resolve or dismiss, so the cashier learns the outcome", () => {
    for (const status of ["resolved", "dismissed"]) {
      const r = validateFlagUpdate({ status });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.resolution_note).toBeDefined();
    }
    expect(validateFlagUpdate({ status: "resolved", resolution_note: "  Price fixed  " })).toEqual({
      ok: true,
      value: { status: "resolved", resolution_note: "Price fixed" },
    });
  });

  it("rejects an unknown status, an oversize note, and a non-object", () => {
    expect(validateFlagUpdate({ status: "done" }).ok).toBe(false);
    expect(validateFlagUpdate({ status: "in_review", resolution_note: "x".repeat(501) }).ok).toBe(false);
    expect(validateFlagUpdate("nope").ok).toBe(false);
  });
});
