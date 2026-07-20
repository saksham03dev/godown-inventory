import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { processReturnStockInServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "inventory.return" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const barcodeId = String(body.barcodeId ?? "").trim();
    const godownId = String(body.godownId ?? "").trim();
    const reason = body.reason != null ? String(body.reason) : null;

    const handledBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    const bagsQty =
      body.bagsQty === null || body.bagsQty === undefined
        ? null
        : Math.floor(Number(body.bagsQty));

    if (
      bagsQty !== null &&
      (!Number.isFinite(bagsQty) || bagsQty < 1 || bagsQty > 1000)
    ) {
      return NextResponse.json(
        { success: false, message: "Quantity must be between 1 and 1000 bags." },
        { status: 400 }
      );
    }

    const result = await processReturnStockInServer({
      barcodeId,
      godownId,
      bagsQty,
      handledBy,
      reason,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Return API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Return failed.",
      },
      { status: 500 }
    );
  }
}
