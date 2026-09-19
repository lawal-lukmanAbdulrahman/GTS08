const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WAT_OFFSET_MS = HOUR_MS; // Africa/Lagos is UTC+1 all year (no daylight saving)

/**
 * Midnight at the start of `date`'s day in Lagos, as an instant. Server hosts
 * usually run in UTC, so "today" can't be the host's local midnight: a sale at
 * 11:30pm in Lagos would fall on the wrong day.
 */
export function startOfWATDay(date: Date): Date {
  const shifted = date.getTime() + WAT_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - WAT_OFFSET_MS);
}

export type SalesRange = "today" | "week" | "month";

const RANGE_DAYS: Record<SalesRange, number> = { today: 0, week: 6, month: 29 };

/** Start of a rolling range ending now: today, the last 7 days, or the last 30 (in Lagos days). */
export function rangeStart(range: SalesRange, now: Date = new Date()): Date {
  return new Date(startOfWATDay(now).getTime() - RANGE_DAYS[range] * DAY_MS);
}
