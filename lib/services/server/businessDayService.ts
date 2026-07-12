import { createServiceClient } from "@/lib/supabase/service";
import type { Bill, DailyBillClosing, MutationResult } from "@/lib/types/database";
import { getTodayBusinessDate } from "@/lib/utils/businessDay";

function db() {
  return createServiceClient({ requireServiceRole: true });
}

export async function ensurePastDaysClosedServer(
  closedBy: string
): Promise<MutationResult<{ closedCount: number; today: string }>> {
  try {
    const { data, error } = await db().rpc("ensure_past_business_days_closed", {
      p_closed_by: closedBy,
    });
    if (error) return { success: false, message: error.message };

    const row = data as {
      success?: boolean;
      message?: string;
      closedCount?: number;
      today?: string;
    } | null;

    if (!row?.success) {
      return {
        success: false,
        message: row?.message ?? "Failed to ensure day closings.",
      };
    }

    return {
      success: true,
      message: row.message ?? "Past days closed.",
      data: {
        closedCount: row.closedCount ?? 0,
        today: row.today ?? getTodayBusinessDate(),
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Day close failed.",
    };
  }
}

export async function fetchDailyClosingsServer(
  limit = 60
): Promise<DailyBillClosing[]> {
  const { data, error } = await db()
    .from("daily_bill_closings")
    .select("*")
    .order("business_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as DailyBillClosing[];
}

export async function fetchBillsForBusinessDateServer(
  businessDate: string
): Promise<Bill[]> {
  const today = getTodayBusinessDate();

  if (businessDate === today) {
    const [{ data: drafts, error: dErr }, { data: finals, error: fErr }] =
      await Promise.all([
        db()
          .from("bills")
          .select("*")
          .eq("status", "DRAFT")
          .order("created_at", { ascending: false })
          .limit(50),
        db()
          .from("bills")
          .select("*")
          .eq("status", "FINALIZED")
          .eq("business_date", businessDate)
          .order("finalized_at", { ascending: false })
          .limit(100),
      ]);

    if (dErr) throw new Error(dErr.message);
    if (fErr) throw new Error(fErr.message);

    return [...(drafts ?? []), ...(finals ?? [])] as Bill[];
  }

  const { data, error } = await db()
    .from("bills")
    .select("*")
    .eq("status", "FINALIZED")
    .eq("business_date", businessDate)
    .order("finalized_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as Bill[];
}
