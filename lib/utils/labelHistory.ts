export function labelHistorySinceMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

/** Returns an ISO string for midnight on the 1st of the current calendar month. */
export function labelHistoryStartOfCurrentMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}