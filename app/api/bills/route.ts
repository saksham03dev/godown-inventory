import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { createBillServer } from "@/lib/services/server/billMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "billing.create" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await createBillServer(body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Create bill error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to create bill.",
      },
      { status: 500 }
    );
  }
}
