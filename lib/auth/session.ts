import { SignJWT } from "jose";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySessionToken,
  clearSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session-edge";

export { SESSION_COOKIE, verifySessionToken, type SessionPayload };

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set in environment variables");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "last_active"> & { last_active?: number }
): Promise<string> {
  const last_active = payload.last_active ?? Math.floor(Date.now() / 1000);

  return new SignJWT({
    username: payload.username,
    full_name: payload.full_name,
    role: payload.role,
    last_active,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { clearSessionCookie };
