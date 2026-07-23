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
