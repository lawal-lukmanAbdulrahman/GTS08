import { describe, it, expect } from "vitest";
import { statusChoices, describeStatus } from "./order-status-options";

describe("statusChoices (what an admin may do with an order)", () => {
  it("offers the current status and only the legal next steps", () => {
    expect(statusChoices({ status: "paid", channel: "online" }).map((c) => c.value)).toEqual(["paid", "confirmed", "cancelled"]);
    expect(statusChoices({ status: "shipped", channel: "online" }).map((c) => c.value)).toEqual(["shipped", "delivered"]);
  });
  it("never offers 'paid' as a choice to set", () => {
    expect(statusChoices({ status: "pending_payment", channel: "whatsapp" }).map((c) => c.value)).toEqual(["pending_payment", "cancelled"]);
  });
  it("offers nothing to change on finished orders and walk-in sales", () => {
    expect(statusChoices({ status: "delivered", channel: "online" })).toHaveLength(1);
    expect(statusChoices({ status: "completed", channel: "walk_in" })).toHaveLength(1);
  });
  it("labels choices in plain words", () => {
    expect(describeStatus("pending_payment")).toBe("Pending payment");
  });
});
