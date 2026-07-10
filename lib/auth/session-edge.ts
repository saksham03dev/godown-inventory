import { jwtVerify } from "jose";
import type { UserRole } from "@/lib/auth/roles";
import { INACTIVITY_TIMEOUT_SECONDS } from "@/lib/auth/idle-timeout";

export const SESSION_COOKIE = "portal_session";

export interface SessionPayload {
  sub: string;
  username: string;
  full_name: string;
  role: UserRole;
  last_active: number;
}

function getSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function isSessionIdle(last_active: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - last_active > INACTIVITY_TIMEOUT_SECONDS;
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;

    const username = payload.username;
    const full_name = payload.full_name;
    const role = payload.role;
    const last_active = payload.last_active;

    if (
      typeof username !== "string" ||
      typeof full_name !== "string" ||
      (role !== "admin" && role !== "manager" && role !== "employee") ||
      typeof last_active !== "number"
    ) {
      return null;
    }

    if (isSessionIdle(last_active)) {
      return null;
    }

    return { sub, username, full_name, role, last_active };
  } catch {
    return null;
  }
}

export function clearSessionCookie(response: {
  cookies: { set: (name: string, value: string, options: object) => void };
}) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
