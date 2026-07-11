import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { processUnitStockTransactionServer } from "@/lib/services/server/stockMutationService";
import type { TransactionType } from "@/lib/types/database";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "scan" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const barcodeId = String(body.barcodeId ?? "").trim();
    const godownId = String(body.godownId ?? "").trim();
    const transactionType = body.transactionType as TransactionType;

    if (transactionType !== "STOCK_IN" && transactionType !== "STOCK_OUT") {
      return NextResponse.json(
        { success: false, message: "Invalid transaction type." },
        { status: 400 }
      );
    }

    const handledBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    const result = await processUnitStockTransactionServer({
      barcodeId,
      godownId,
      transactionType,
      handledBy,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Scan API error:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "Scan transaction failed.",
      },
      { status: 500 }
    );
  }
}
