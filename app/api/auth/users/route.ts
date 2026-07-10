import { NextResponse } from "next/server";
import { listActiveUsersByRole } from "@/lib/services/portalUserService";
import type { UserRole } from "@/lib/auth/roles";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") as UserRole | null;

    if (!role || !["admin", "manager", "employee"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const users = await listActiveUsersByRole(role);
    return NextResponse.json({ users });
  } catch (err) {
    console.error("List users error:", err);
    return NextResponse.json(
      { error: "Failed to load users." },
      { status: 500 }
    );
  }
}
