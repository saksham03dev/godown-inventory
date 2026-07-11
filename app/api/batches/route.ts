import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { createStockBatchServer } from "@/lib/services/server/batchMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "labels" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const createdBy =
      auth.session.username || auth.session.full_name || auth.session.sub;
    const result = await createStockBatchServer(body, createdBy);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Create batch error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to create batch.",
      },
      { status: 500 }
    );
  }
}
