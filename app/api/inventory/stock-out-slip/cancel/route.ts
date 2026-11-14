import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { cancelStockOutSlipServer } from "@/lib/services/server/stockOutSlipService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "scan" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const slipId = String(body.slipId ?? "").trim();
    if (!slipId) {
      return NextResponse.json(
        { success: false, message: "Slip id is required." },
        { status: 400 }
      );
    }

    const result = await cancelStockOutSlipServer(slipId);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Stock-out slip cancel error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to cancel bill.",
      },
      { status: 500 }
    );
  }
}