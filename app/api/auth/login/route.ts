import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { getUserWithPassword } from "@/lib/services/portalUserService";
import type { UserRole } from "@/lib/auth/roles";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = String(body.userId ?? "");
    const password = String(body.password ?? "");
    const role = body.role as UserRole;

    if (!userId || !password || !role) {
      return NextResponse.json(
        { error: "Select a user and enter your password." },
        { status: 400 }
      );
    }

    const user = await getUserWithPassword(userId);
    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (user.role !== role) {
      return NextResponse.json(
        { error: "This user does not belong to the selected role." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = await createSessionToken({
      sub: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Login failed. Check server configuration." },
      { status: 500 }
    );
  }
}
