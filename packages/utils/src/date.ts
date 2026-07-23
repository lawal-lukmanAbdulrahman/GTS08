const WAT_TIMEZONE = "Africa/Lagos";

const defaultFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: WAT_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: WAT_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * Format a UTC timestamp for display in WAT (Africa/Lagos, UTC+1).
 * All timestamps in DB are TIMESTAMPTZ (UTC); display is always WAT.
 *
 * @example formatWAT("2026-07-15T13:14:00Z") → "Jul 15, 2026, 2:14 PM"
 */
export function formatWAT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return defaultFormatter.format(d);
}

/**
 * Format a UTC timestamp as date-only in WAT.
 */
export function formatWATDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateOnlyFormatter.format(d);
}

/**
 * Convert a Date to ISO string for DB writes (UTC).
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}
