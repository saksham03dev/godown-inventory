import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { addRetailLineToBillServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const billId = String(body.billId ?? "").trim();
    const unitBarcode = String(
      body.unitBarcode ?? body.barcode ?? ""
    ).trim();
    const bagsQty = Number(body.bagsQty ?? body.quantity ?? 0);
    const unitPrice = Number(body.unitPrice ?? 0);

    if (!billId || !unitBarcode) {
      return NextResponse.json(
        { success: false, message: "Bill and bale barcode are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(bagsQty) || bagsQty < 1) {
      return NextResponse.json(
        { success: false, message: "Minimum sale is 1 bag." },
        { status: 400 }
      );
    }

    const handledBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    const result = await addRetailLineToBillServer({
      billId,
      unitBarcode,
      bagsQty: Math.floor(bagsQty),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      handledBy,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Retail bill line API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Retail sale failed.",
      },
      { status: 500 }
    );
  }
}
