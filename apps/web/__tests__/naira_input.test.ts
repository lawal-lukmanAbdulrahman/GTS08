import { describe, it, expect } from "vitest";
import { parseNairaInput } from "@gts/utils";

describe("parseNairaInput (typed Naira -> exact kobo, no floats)", () => {
  it.each([
    ["1500", 150000],
    ["0", 0],
    ["1,500", 150000],
    ["1,234,567", 123456700],
    ["1500.5", 150050],
    ["1500.50", 150050],
    ["0.99", 99],
    [".5", 50],
    ["  250  ", 25000],
    ["₦1,500", 150000],
  ])("reads %j as %i kobo", (text, kobo) => {
    expect(parseNairaInput(text)).toBe(kobo);
  });

  it("is exact where floating point isn't (19.99 * 100 = 1998.9999999999998)", () => {
    expect(parseNairaInput("19.99")).toBe(1999);
    expect(parseNairaInput("1.15")).toBe(115);
    expect(parseNairaInput("0.29")).toBe(29);
  });

  it.each(["", "  ", "abc", "-5", "1e3", "1.234", "1.2.3", "12,34,5x", "₦", ".", "--1", "5 000"])("rejects %j", (text) => {
    expect(parseNairaInput(text)).toBeNull();
  });

  it("rejects amounts too large to hold safely", () => {
    expect(parseNairaInput("99999999999999999999")).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(parseNairaInput(150 as never)).toBeNull();
    expect(parseNairaInput(null as never)).toBeNull();
  });
});
