import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import {
  createPortalUser,
  listAllUsers,
} from "@/lib/services/portalUserService";
import type { UserRole } from "@/lib/auth/roles";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const users = await listAllUsers();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("Admin list users error:", err);
    return NextResponse.json(
      { error: "Failed to load users." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim();
    const full_name = String(body.full_name ?? "").trim();
    const role = body.role as UserRole;
    const password = String(body.password ?? "");

    if (!username || !full_name || !password) {
      return NextResponse.json(
        { error: "Username, full name, and password are required." },
        { status: 400 }
      );
    }

    if (!["admin", "manager", "employee"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const user = await createPortalUser({
      username,
      full_name,
      role,
      password,
      is_active: true,
    });

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes("unique")
        ? "Username already exists."
        : "Failed to create user.";
    console.error("Create user error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
