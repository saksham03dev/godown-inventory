import { NextResponse } from "next/server";
import { listActiveUsersByRole } from "@/lib/services/portalUserService";
import type { UserRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") as UserRole | null;

    if (!role || !["admin", "manager", "employee"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const users = await listActiveUsersByRole(role);
    return NextResponse.json({
      users,
      meta: {
        role,
        count: users.length,
        supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load users.";
    console.error("List users error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
