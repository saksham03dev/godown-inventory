import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { fetchBillsForBusinessDateServer } from "@/lib/services/server/businessDayService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> }
) {
  const auth = await requireSession({ permission: "billing.view" });
  if (auth.error) return auth.error;

  try {
    const { date } = await context.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid date." },
        { status: 400 }
      );
    }

    const bills = await fetchBillsForBusinessDateServer(date);
    return NextResponse.json({ success: true, date, bills });
  } catch (err) {
    console.error("Day bills API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to load day bills.",
      },
      { status: 500 }
    );
  }
}
