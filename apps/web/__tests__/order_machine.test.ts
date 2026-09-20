import { describe, it, expect } from "vitest";
import { canTransition, nextStatuses, stockEffectOfCancel } from "../app/api/v1/_lib/order-machine";

describe("order status machine (admin route)", () => {
  it("moves forward one step at a time", () => {
    expect(nextStatuses("paid")).toEqual(["confirmed", "cancelled"]);
    expect(nextStatuses("confirmed")).toEqual(["processing", "cancelled"]);
    expect(nextStatuses("processing")).toEqual(["shipped", "cancelled"]);
    expect(nextStatuses("shipped")).toEqual(["delivered"]);
  });

  it("never lets an admin mark an order paid, and only cancels an unpaid one", () => {
    expect(nextStatuses("pending_payment")).toEqual(["cancelled"]);
    expect(canTransition("pending_payment", "paid")).toBe(false);
  });

  it("refuses skipped steps and backward moves", () => {
    expect(canTransition("paid", "shipped")).toBe(false);
    expect(canTransition("processing", "confirmed")).toBe(false);
    expect(canTransition("delivered", "shipped")).toBe(false);
  });

  it("treats finished and unknown states as closed", () => {
    for (const s of ["delivered", "cancelled", "completed", "voided", "nonsense"]) expect(nextStatuses(s)).toEqual([]);
    expect(canTransition("paid", "voided")).toBe(false);
    expect(canTransition("paid", "nonsense")).toBe(false);
  });

  it("says what a cancellation does to stock: release a hold if unpaid, put stock back if paid", () => {
    expect(stockEffectOfCancel("pending_payment")).toBe("release");
    for (const s of ["paid", "confirmed", "processing"]) expect(stockEffectOfCancel(s)).toBe("restock");
  });
});
