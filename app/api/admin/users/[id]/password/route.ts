import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { updatePortalUserPassword } from "@/lib/services/portalUserService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const password = String(body.password ?? "");

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const updated = await updatePortalUserPassword(id, password);
    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json(
      { error: "Failed to change password." },
      { status: 500 }
    );
  }
}
