/** The reasons a stock movement may be recorded with (a CHECK constraint on stock_movements.reason). */
export const MOVEMENT_REASONS = ["restock", "adjustment", "return", "write_off", "correction"] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/**
 * Turns whatever reason a caller gave into one the database accepts, keeping
 * their words in the note. Without this a free-text reason makes the movement
 * insert fail, and the stock change is left with no audit row.
 */
export function movementReason(reason: string, notes: string | null): { reason: MovementReason | "sale_pos"; notes: string | null } {
  const r = reason.trim();
  if ((MOVEMENT_REASONS as readonly string[]).includes(r) || r === "sale_pos") return { reason: r as MovementReason, notes };
  return { reason: "adjustment", notes: notes ? `${r}: ${notes}` : r };
}
