import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadPaperSize, savePaperSize, DEFAULT_PAPER } from "./receipt-paper";

describe("receipt paper preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to 80mm, the most common till roll", () => {
    expect(DEFAULT_PAPER).toBe("80mm");
    expect(loadPaperSize()).toBe("80mm");
  });

  it("remembers the cashier's choice", () => {
    savePaperSize("58mm");
    expect(loadPaperSize()).toBe("58mm");
    savePaperSize("a4");
    expect(loadPaperSize()).toBe("a4");
  });

  it("ignores a corrupted stored value", () => {
    localStorage.setItem("gts_receipt_paper", "letter");
    expect(loadPaperSize()).toBe("80mm");
  });

  it("still works when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadPaperSize()).toBe("80mm");
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => savePaperSize("58mm")).not.toThrow();
    set.mockRestore();
  });
});
