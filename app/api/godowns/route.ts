import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { createGodownServer } from "@/lib/services/server/godownMutationService";

export async function POST(request: Request) {
  const auth = await requireSession({ permission: "godowns.manage" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const result = await createGodownServer(body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("Create godown error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to create godown.",
      },
      { status: 500 }
    );
  }
}
