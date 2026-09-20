/**
 * Where an online or WhatsApp order may go next when an admin moves it by hand.
 * Forward one step at a time, and cancellation up to the point it ships.
 * "paid" is deliberately absent as a target: only the Paystack webhook (online)
 * or a cashier confirming payment (WhatsApp) marks an order paid. Walk-in
 * sales are never moved here; voiding them is a POS action.
 */
const NEXT: Record<string, string[]> = {
  pending_payment: ["cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

export const nextStatuses = (from: string): string[] => NEXT[from] ?? [];
export const canTransition = (from: string, to: string): boolean => nextStatuses(from).includes(to);

/** Unpaid orders only hold stock (release it); paid ones have already taken it (put it back). */
export const stockEffectOfCancel = (from: string): "release" | "restock" => (from === "pending_payment" ? "release" : "restock");
