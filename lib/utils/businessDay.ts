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
