/** Store calendar timezone for business-day boundaries. */
export const BUSINESS_TIMEZONE = "Asia/Kolkata" as const;

/** Today's business date as YYYY-MM-DD in store timezone. */
export function getTodayBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Human label e.g. "Sun, 12 Jul 2026". */
export function formatBusinessDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function isTodayBusinessDate(isoDate: string): boolean {
  return isoDate === getTodayBusinessDate();
}

/** True for YYYY-MM-DD. */
export function isValidBusinessDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

/**
 * Half-open UTC range for a store calendar day in Asia/Kolkata.
 * Kolkata has no DST, so +05:30 is stable year-round.
 */
export function businessDayUtcRange(isoDate: string): {
  startIso: string;
  endIso: string;
} {
  if (!isValidBusinessDate(isoDate)) {
    throw new Error(`Invalid business date: ${isoDate}`);
  }
  const start = new Date(`${isoDate}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
