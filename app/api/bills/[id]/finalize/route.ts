import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { finalizeBillServer } from "@/lib/services/server/billMutationService";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const result = await finalizeBillServer(id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Finalize bill error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to finalize bill.",
      },
      { status: 500 }
    );
  }
}
