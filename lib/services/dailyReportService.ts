import type { DailyReport, MutationResult } from "@/lib/types/database";

export async function fetchDailyReport(date: string): Promise<DailyReport> {
  const res = await fetch(
    `/api/reports/daily?date=${encodeURIComponent(date)}`,
    { cache: "no-store" }
  );
  const data = (await res.json()) as MutationResult<DailyReport>;
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to load daily report.");
  }
  return data.data;
}
