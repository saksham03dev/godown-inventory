import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { confirmStockOutSlipServer } from "@/lib/services/server/stockOutSlipService";
import type { StockOutSlipChannel, StockOutSlipConfirmItem } from "@/lib/types/database";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "scan" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const saleChannel = String(body.saleChannel ?? "").toUpperCase() as StockOutSlipChannel;
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: StockOutSlipConfirmItem[] = rawItems.map(
      (item: { barcode?: string; bagsQty?: number }) => ({
        barcode: String(item.barcode ?? "").trim(),
        bagsQty: Math.floor(Number(item.bagsQty)),
      })
    );

    const createdByLabel =
      auth.session.username || auth.session.full_name || auth.session.sub;

    const result = await confirmStockOutSlipServer({
      billerName: body.billerName ?? null,
      billNo: body.billNo ?? null,
      saleChannel,
      items,
      createdBy: auth.session.sub,
      createdByLabel,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Stock-out slip confirm error:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "Failed to confirm stock-out slip.",
      },
      { status: 500 }
    );
  }
}
