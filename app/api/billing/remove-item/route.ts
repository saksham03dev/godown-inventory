import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { removeBillItemServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const itemId = String(body.itemId ?? "").trim();
    if (!itemId) {
      return NextResponse.json(
        { success: false, message: "Item id is required." },
        { status: 400 }
      );
    }

    const result = await removeBillItemServer(itemId);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Billing remove-item API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to remove item.",
      },
      { status: 500 }
    );
  }
}
