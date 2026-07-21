import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { correctUnitGodownServer } from "@/lib/services/server/stockMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "inventory.relocate" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const barcodeId = String(body.barcodeId ?? "").trim();
    const toGodownId = String(body.toGodownId ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    const handledBy =
      auth.session.username ||
      auth.session.full_name ||
      auth.session.sub;

    const result = await correctUnitGodownServer({
      barcodeId,
      toGodownId,
      handledBy,
      reason: reason || null,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Correct godown API error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Relocation failed.",
      },
      { status: 500 }
    );
  }
}
