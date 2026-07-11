import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { deleteBillServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const billId = String(body.billId ?? "").trim();
    if (!billId) {
      return NextResponse.json(
        { success: false, message: "Bill id is required." },
        { status: 400 }
      );
    }

    const result = await deleteBillServer(billId);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Billing delete-bill API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to delete bill.",
      },
      { status: 500 }
    );
  }
}
