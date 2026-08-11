import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { fetchDailyReportServer } from "@/lib/services/server/dailyReportService";
import { isValidBusinessDate } from "@/lib/utils/businessDay";

export async function GET(request: Request) {
  const auth = await requireSession({ permission: "dashboard" });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const date = (searchParams.get("date") ?? "").trim();

    if (!isValidBusinessDate(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const report = await fetchDailyReportServer(date);
    return NextResponse.json({ success: true, message: "OK", data: report });
  } catch (err) {
    console.error("Daily report API error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load daily report.";
    const status = /future|Invalid date/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
