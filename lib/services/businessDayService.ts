import { apiJson } from "@/lib/api/clientMutation";
import type { Bill, DailyBillClosing } from "@/lib/types/database";

export async function fetchBusinessDays(): Promise<{
  success: boolean;
  today: string;
  closings: DailyBillClosing[];
  message?: string;
}> {
  const res = await fetch("/api/billing/days", { method: "GET" });
  return res.json();
}

export async function ensurePastDaysClosed(): Promise<{
  success: boolean;
  message: string;
}> {
  return apiJson("/api/billing/days", { method: "POST" });
}

export async function fetchBillsForDay(date: string): Promise<{
  success: boolean;
  date: string;
  bills: Bill[];
  message?: string;
}> {
  const res = await fetch(`/api/billing/days/${date}`, { method: "GET" });
  return res.json();
}
