import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { attachUnitToBillServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const billId = String(body.billId ?? "").trim();
    const unitBarcode = String(body.unitBarcode ?? body.barcode ?? "").trim();
    const unitPrice = Number(body.unitPrice ?? 0);

    if (!billId || !unitBarcode) {
      return NextResponse.json(
        { success: false, message: "Bill and unit barcode are required." },
        { status: 400 }
      );
    }

    const result = await attachUnitToBillServer({
      billId,
      unitBarcode,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Billing add-unit API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to add item.",
      },
      { status: 500 }
    );
  }
}
