import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  deleteProductServer,
  updateProductServer,
} from "@/lib/services/server/productMutationService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ permission: "products.edit" });
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { options, ...input } = body;
    const result = await updateProductServer(id, input, options);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Update product error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to update product.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession({ permission: "products.delete" });
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const result = await deleteProductServer(id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Delete product error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to delete product.",
      },
      { status: 500 }
    );
  }
}
