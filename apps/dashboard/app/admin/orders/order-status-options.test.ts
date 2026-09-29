import { describe, it, expect } from "vitest";
import { statusChoices, describeStatus, FORWARD_NEXT, BACKWARD_STEP } from "./order-status-options";

describe("statusChoices (what an admin may do with an order in pickup model)", () => {
  it("offers the current status and only the legal next steps for pickup flow", () => {
    expect(statusChoices({ status: "placed", channel: "online" }).map((c) => c.value)).toEqual([
      "placed",
      "confirmed",
      "on_hold",
      "cancelled",
    ]);
    expect(statusChoices({ status: "confirmed", channel: "online" }).map((c) => c.value)).toEqual([
      "confirmed",
      "ready_for_pickup",
      "placed",
      "on_hold",
      "cancelled",
    ]);
    expect(statusChoices({ status: "ready_for_pickup", channel: "online" }).map((c) => c.value)).toEqual([
      "ready_for_pickup",
      "collected",
      "confirmed",
      "on_hold",
      "expired",
      "cancelled",
    ]);
  });

  it("offers nothing to change on finished orders and walk-in sales", () => {
    expect(statusChoices({ status: "collected", channel: "online" })).toHaveLength(1);
    expect(statusChoices({ status: "completed", channel: "walk_in" })).toHaveLength(1);
  });

  it("labels choices in clear human words", () => {
    expect(describeStatus("placed")).toBe("Placed");
    expect(describeStatus("ready_for_pickup")).toBe("Ready for Pickup");
    expect(describeStatus("on_hold")).toBe("On Hold");
    expect(describeStatus("collected")).toBe("Collected");
  });

  it("exposes forward and backward helpers", () => {
    expect(FORWARD_NEXT.placed).toBe("confirmed");
    expect(FORWARD_NEXT.confirmed).toBe("ready_for_pickup");
    expect(FORWARD_NEXT.ready_for_pickup).toBe("collected");
    expect(BACKWARD_STEP.ready_for_pickup).toBe("confirmed");
    expect(BACKWARD_STEP.confirmed).toBe("placed");
  });
});
