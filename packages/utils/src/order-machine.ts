/**
 * Pickup-only order fulfillment state machine.
 *
 * Fulfilment Progress (forward-by-default):
 *   placed -> confirmed -> ready_for_pickup -> collected
 *
 * Rules:
 *   - collected is terminal; cannot transition out or cancel once collected.
 *   - cannot transition to collected unless payment_status is 'paid'.
 *   - moving backward (ready_for_pickup -> confirmed, confirmed -> placed) requires a reason.
 *   - cancellation is allowed from any non-collected state and requires a reason.
 *   - on_hold is allowed from placed, confirmed, ready_for_pickup, and requires a reason.
 *   - expired is set when pickup window lapses from ready_for_pickup; staff can reopen it with a reason.
 */

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "ready_for_pickup"
  | "collected"
  | "cancelled"
  | "expired"
  | "on_hold";

export type PaymentStatus = "unpaid" | "paid";

/** Next forward step in the happy path */
export const FORWARD_NEXT: Record<string, string | null> = {
  placed: "confirmed",
  confirmed: "ready_for_pickup",
  ready_for_pickup: "collected",
  collected: null,
  paid: "confirmed",
  processing: "shipped",
  shipped: "delivered",
};

/** Previous step if an order needs to be moved back */
export const BACKWARD_STEP: Record<string, string | null> = {
  ready_for_pickup: "confirmed",
  confirmed: "placed",
  placed: null,
};

/** All allowed state transitions */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  placed: ["confirmed", "on_hold", "cancelled"],
  confirmed: ["ready_for_pickup", "placed", "on_hold", "cancelled"],
  ready_for_pickup: ["collected", "confirmed", "on_hold", "expired", "cancelled"],
  on_hold: ["placed", "confirmed", "ready_for_pickup", "cancelled"],
  expired: ["ready_for_pickup", "cancelled"],
  collected: [],
  cancelled: [],
  voided: [],
  // Backwards compatibility with legacy/test orders
  pending_payment: ["cancelled"],
  paid: ["confirmed", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
};

export const nextStatuses = (from: string): string[] => ALLOWED_TRANSITIONS[from] ?? [];

export const canTransition = (from: string, to: string): boolean =>
  nextStatuses(from).includes(to);

/** Checks whether moving from `from` to `to` requires a documented reason */
export function requiresReason(from: string, to: string): boolean {
  if (to === "cancelled" || to === "on_hold") return true;
  if (from === "expired" && to === "ready_for_pickup") return true; // reopening
  if (from === "ready_for_pickup" && to === "confirmed") return true; // moving backward
  if (from === "confirmed" && to === "placed") return true; // moving backward
  return false;
}

/** Comprehensive server-side validation for an order transition */
export function validateTransition(
  from: string,
  to: string,
  paymentStatus: string,
  reason?: string | null
): { ok: true } | { ok: false; reason: string; code: string } {
  if (from === "collected") {
    return { ok: false, reason: "Collected orders cannot be modified or cancelled.", code: "ALREADY_COLLECTED" };
  }
  if (!canTransition(from, to)) {
    return {
      ok: false,
      reason: `Cannot move order from ${from.replace(/_/g, " ")} to ${to.replace(/_/g, " ")}.`,
      code: "INVALID_TRANSITION",
    };
  }
  if (to === "collected" && paymentStatus !== "paid") {
    return {
      ok: false,
      reason: "Order cannot be marked as collected until payment is confirmed.",
      code: "PAYMENT_REQUIRED",
    };
  }
  if (requiresReason(from, to) && reason !== undefined && reason !== null && !reason.trim()) {
    return {
      ok: false,
      reason: `A reason is required when transitioning to ${to.replace(/_/g, " ")}.`,
      code: "REASON_REQUIRED",
    };
  }
  return { ok: true };
}

/**
 * Stock effect when cancelling or expiring an order:
 * If unpaid, release the reserved inventory hold; if paid, put items back in stock.
 */
export const stockEffectOfCancel = (statusOrPayment: string): "release" | "restock" =>
  statusOrPayment === "unpaid" || statusOrPayment === "pending_payment" ? "release" : "restock";
