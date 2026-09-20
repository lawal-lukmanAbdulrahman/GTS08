import { nextStatuses } from "@gts/utils";

export const describeStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

/** The current status first (meaning "leave it"), then only the moves the server will accept. */
export function statusChoices(order: { status: string; channel: string }): Array<{ value: string; label: string }> {
  const next = order.channel === "walk_in" ? [] : nextStatuses(order.status);
  return [order.status, ...next].map((value) => ({ value, label: describeStatus(value) }));
}
