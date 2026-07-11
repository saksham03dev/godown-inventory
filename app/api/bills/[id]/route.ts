import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { updateBillServer } from "@/lib/services/server/billMutationService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await updateBillServer(id, body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Update bill error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to update bill.",
      },
      { status: 500 }
    );
  }
}
