import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  deleteGodownServer,
  updateGodownServer,
} from "@/lib/services/server/godownMutationService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ permission: "godowns.manage" });
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await updateGodownServer(id, body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Update godown error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to update godown.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ permission: "godowns.manage" });
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const result = await deleteGodownServer(id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Delete godown error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to delete godown.",
      },
      { status: 500 }
    );
  }
}
