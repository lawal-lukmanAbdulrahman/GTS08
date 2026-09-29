import {
  nextStatuses,
  FORWARD_NEXT,
  BACKWARD_STEP,
  requiresReason,
  canTransition,
} from "@gts/utils";

export { FORWARD_NEXT, BACKWARD_STEP, requiresReason, canTransition };

export const describeStatus = (s: string) => {
  if (s === "ready_for_pickup") return "Ready for Pickup";
  if (s === "on_hold") return "On Hold";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
};

/** The current status first (meaning "leave it"), then only the moves the server will accept. */
export function statusChoices(order: { status: string; channel: string }): Array<{ value: string; label: string }> {
  const next = order.channel === "walk_in" ? [] : nextStatuses(order.status);
  return [order.status, ...next].map((value) => ({ value, label: describeStatus(value) }));
}
