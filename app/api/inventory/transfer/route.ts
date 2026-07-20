import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { transferSealedBaleServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "inventory.transfer" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const barcodeId = String(body.barcodeId ?? "").trim();
    const fromGodownId = String(body.fromGodownId ?? "").trim();
    const toGodownId = String(body.toGodownId ?? "").trim();

    const handledBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    const result = await transferSealedBaleServer({
      barcodeId,
      fromGodownId,
      toGodownId,
      handledBy,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Transfer API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Transfer failed.",
      },
      { status: 500 }
    );
  }
}
