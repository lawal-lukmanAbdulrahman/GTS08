/**
 * Format kobo (integer) to Naira display string.
 * All money in the system is stored as kobo integers.
 * This is the ONLY place Naira formatting happens.
 *
 * @example formatKobo(1500000) → "₦15,000"
 * @example formatKobo(2550)    → "₦25.50"
 */
export function formatKobo(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: naira % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Alias for formatKobo */
export const koboToNaira = formatKobo;

/**
 * Convert a Naira amount to kobo. For seed/test use only.
 * Never use this in business logic — always work in kobo.
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Reads a typed Naira amount ("1,500", "₦1,500.50", ".5") as exact integer
 * kobo, or null if it isn't a plain non-negative amount with at most two
 * decimals. Works on the text, never through a float, so 19.99 is exactly
 * 1999 kobo (19.99 * 100 in floating point is 1998.9999999999998).
 */
export function parseNairaInput(text: string): number | null {
  if (typeof text !== "string") return null;
  const cleaned = text.trim().replace(/^₦/, "").replace(/,/g, "");
  const match = cleaned.match(/^(\d*)(?:\.(\d{1,2}))?$/);
  if (!match || (match[1] === "" && match[2] === undefined)) return null;

  const whole = match[1] || "0";
  const kobo = (match[2] ?? "").padEnd(2, "0");
  const total = Number(whole) * 100 + Number(kobo);
  return Number.isSafeInteger(total) ? total : null;
}
