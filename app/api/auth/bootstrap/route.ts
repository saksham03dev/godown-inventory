import { NextResponse } from "next/server";
import {
  countProfiles,
  createPortalUser,
} from "@/lib/services/portalUserService";
import type { UserRole } from "@/lib/auth/roles";

/**
 * One-time first admin setup when no profiles exist.
 * Disabled automatically after the first user is created.
 */
export async function POST(request: Request) {
  try {
    const existing = await countProfiles();
    if (existing > 0) {
      return NextResponse.json(
        { error: "Bootstrap is disabled. An admin already exists." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const full_name = String(body.full_name ?? "").trim() || "System Administrator";
    const password = String(body.password ?? "");

    if (!username || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Username and a password of at least 8 characters are required.",
        },
        { status: 400 }
      );
    }

    const user = await createPortalUser({
      username,
      full_name,
      role: "admin" as UserRole,
      password,
      is_active: true,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
      message: "Admin account created. Sign in with your username and password.",
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create admin account.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const count = await countProfiles();
    return NextResponse.json({ needsBootstrap: count === 0 });
  } catch (err) {
    console.error("Bootstrap status error:", err);
    return NextResponse.json(
      { error: "Unable to check bootstrap status." },
      { status: 500 }
    );
  }
}
