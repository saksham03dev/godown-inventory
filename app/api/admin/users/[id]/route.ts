import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import {
  deletePortalUser,
  getUserById,
  updatePortalUser,
} from "@/lib/services/portalUserService";
import type { UserRole } from "@/lib/auth/roles";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const input: {
      username?: string;
      full_name?: string;
      role?: UserRole;
      is_active?: boolean;
    } = {};

    if (body.username !== undefined) input.username = String(body.username);
    if (body.full_name !== undefined) input.full_name = String(body.full_name);
    if (body.role !== undefined) input.role = body.role as UserRole;
    if (body.is_active !== undefined) input.is_active = Boolean(body.is_active);

    const user = await updatePortalUser(id, input);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes("unique")
        ? "Username already exists."
        : "Failed to update user.";
    console.error("Update user error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  if (auth.session?.sub === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account while signed in." },
      { status: 400 }
    );
  }

  const existing = await getUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await deletePortalUser(id);
  return NextResponse.json({ success: true });
}
