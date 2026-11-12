import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { confirmStockInBatchServer } from "@/lib/services/server/stockInBatchService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "scan" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const handledBy =
      auth.session.username || auth.session.full_name || auth.session.sub;

    const result = await confirmStockInBatchServer({
      uploadId: String(body.uploadId ?? ""),
      godownId: String(body.godownId ?? ""),
      handledBy,
      items: items.map((item: { barcode?: string; bagsQty?: number }) => ({
        barcode: String(item.barcode ?? "").trim(),
        bagsQty: Math.floor(Number(item.bagsQty)),
      })),
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Stock-in batch error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Stock-in upload failed.",
      },
      { status: 500 }
    );
  }
}
