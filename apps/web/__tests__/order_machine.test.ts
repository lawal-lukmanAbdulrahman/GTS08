import { describe, it, expect } from "vitest";
import {
  canTransition,
  nextStatuses,
  stockEffectOfCancel,
  validateTransition,
  requiresReason,
  FORWARD_NEXT,
  BACKWARD_STEP,
} from "../app/api/v1/_lib/order-machine";

describe("pickup order status machine", () => {
  it("defines forward transitions for the 4-step pickup flow", () => {
    expect(FORWARD_NEXT.placed).toBe("confirmed");
    expect(FORWARD_NEXT.confirmed).toBe("ready_for_pickup");
    expect(FORWARD_NEXT.ready_for_pickup).toBe("collected");
    expect(FORWARD_NEXT.collected).toBeNull();
  });

  it("defines backward steps with reason requirements", () => {
    expect(BACKWARD_STEP.ready_for_pickup).toBe("confirmed");
    expect(BACKWARD_STEP.confirmed).toBe("placed");
    expect(BACKWARD_STEP.placed).toBeNull();

    expect(requiresReason("ready_for_pickup", "confirmed")).toBe(true);
    expect(requiresReason("confirmed", "placed")).toBe(true);
    expect(requiresReason("placed", "confirmed")).toBe(false);
  });

  it("enforces payment before collected transition", () => {
    // Unpaid cannot be collected
    const unpaidResult = validateTransition("ready_for_pickup", "collected", "unpaid");
    expect(unpaidResult.ok).toBe(false);
    if (!unpaidResult.ok) {
      expect(unpaidResult.code).toBe("PAYMENT_REQUIRED");
    }

    // Paid can be collected
    const paidResult = validateTransition("ready_for_pickup", "collected", "paid");
    expect(paidResult.ok).toBe(true);
  });

  it("treats collected as terminal", () => {
    expect(nextStatuses("collected")).toEqual([]);
    expect(canTransition("collected", "ready_for_pickup")).toBe(false);
    expect(canTransition("collected", "cancelled")).toBe(false);

    const res = validateTransition("collected", "cancelled", "paid", "customer request");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("ALREADY_COLLECTED");
    }
  });

  it("requires a reason when cancelling or placing on hold", () => {
    expect(requiresReason("placed", "cancelled")).toBe(true);
    expect(requiresReason("confirmed", "on_hold")).toBe(true);

    const withoutReason = validateTransition("confirmed", "cancelled", "paid", "");
    expect(withoutReason.ok).toBe(false);
    if (!withoutReason.ok) {
      expect(withoutReason.code).toBe("REASON_REQUIRED");
    }

    const withReason = validateTransition("confirmed", "cancelled", "paid", "Customer changed mind");
    expect(withReason.ok).toBe(true);
  });

  it("allows reopening an expired order with a reason", () => {
    expect(canTransition("expired", "ready_for_pickup")).toBe(true);
    expect(requiresReason("expired", "ready_for_pickup")).toBe(true);

    const res = validateTransition("expired", "ready_for_pickup", "paid", "Customer arrived to collect");
    expect(res.ok).toBe(true);
  });

  it("computes stock effect of cancellation based on payment or status", () => {
    expect(stockEffectOfCancel("unpaid")).toBe("release");
    expect(stockEffectOfCancel("paid")).toBe("restock");
    expect(stockEffectOfCancel("pending_payment")).toBe("release");
  });
});
