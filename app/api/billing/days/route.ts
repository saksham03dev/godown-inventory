import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  ensurePastDaysClosedServer,
  fetchDailyClosingsServer,
} from "@/lib/services/server/businessDayService";
import { getTodayBusinessDate } from "@/lib/utils/businessDay";

/** Ensure past days are closed, then return today + closed days list. */
export async function GET() {
  const auth = await requireSession({ permission: "billing.view" });
  if (auth.error) return auth.error;

  try {
    const closedBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    await ensurePastDaysClosedServer(closedBy);
    const closings = await fetchDailyClosingsServer();
    const today = getTodayBusinessDate();

    return NextResponse.json({
      success: true,
      today,
      closings,
    });
  } catch (err) {
    console.error("Business days API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to load days.",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const closedBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    const result = await ensurePastDaysClosedServer(closedBy);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Ensure days closed error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to close days.",
      },
      { status: 500 }
    );
  }
}
