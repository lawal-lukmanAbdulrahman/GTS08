import { describe, it, expect } from "vitest";
import { validatePhoneNumber, validatePasswordChange } from "@gts/utils";

describe("validatePhoneNumber", () => {
  it("accepts common Nigerian formats and trims them", () => {
    expect(validatePhoneNumber("  0803 123 4567 ")).toEqual({ ok: true, value: "0803 123 4567" });
    expect(validatePhoneNumber("+234 803 123 4567")).toEqual({ ok: true, value: "+234 803 123 4567" });
    expect(validatePhoneNumber("(0803) 123-4567")).toEqual({ ok: true, value: "(0803) 123-4567" });
  });

  it("lets a phone number be cleared", () => {
    expect(validatePhoneNumber("")).toEqual({ ok: true, value: null });
    expect(validatePhoneNumber("   ")).toEqual({ ok: true, value: null });
    expect(validatePhoneNumber(null)).toEqual({ ok: true, value: null });
  });

  it("rejects letters and symbols", () => {
    expect(validatePhoneNumber("call me").ok).toBe(false);
    expect(validatePhoneNumber("0803<b>").ok).toBe(false);
  });

  it("rejects numbers that are too short or too long to be real", () => {
    expect(validatePhoneNumber("12345").ok).toBe(false);
    expect(validatePhoneNumber("0".repeat(21)).ok).toBe(false);
  });

  it("rejects non-text values", () => {
    expect(validatePhoneNumber(8031234567 as never).ok).toBe(false);
    expect(validatePhoneNumber({} as never).ok).toBe(false);
  });
});

describe("validatePasswordChange (employee spec Part 8: current + new + confirm)", () => {
  const good = { current: "OldPass123!", next: "NewPass456!", confirm: "NewPass456!" };

  it("accepts a valid change", () => {
    expect(validatePasswordChange(good)).toEqual({ ok: true });
  });

  it("requires the current password", () => {
    const r = validatePasswordChange({ ...good, current: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.current_password).toBeDefined();
  });

  it("requires at least 8 characters with a letter and a number", () => {
    for (const weak of ["short1", "onlyletters", "12345678"]) {
      const r = validatePasswordChange({ ...good, next: weak, confirm: weak });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.new_password).toBeDefined();
    }
  });

  it("caps the length at 72 (the limit password hashing honours)", () => {
    const long = "a1" + "x".repeat(71);
    const r = validatePasswordChange({ ...good, next: long, confirm: long });
    expect(r.ok).toBe(false);
  });

  it("requires the confirmation to match", () => {
    const r = validatePasswordChange({ ...good, confirm: "Different789!" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.confirm_password).toMatch(/match/i);
  });

  it("refuses to 'change' to the same password", () => {
    const r = validatePasswordChange({ current: "SamePass123", next: "SamePass123", confirm: "SamePass123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.new_password).toMatch(/different/i);
  });

  it("reports every problem at once", () => {
    const r = validatePasswordChange({ current: "", next: "abc", confirm: "xyz" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["confirm_password", "current_password", "new_password"]);
  });
});
