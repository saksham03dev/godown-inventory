import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { createProductServer } from "@/lib/services/server/productMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "products.create" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const result = await createProductServer(body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Create product error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to create product.",
      },
      { status: 500 }
    );
  }
}
