import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionFromCookies,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    const response = NextResponse.json(
      { error: "Session expired due to inactivity." },
      { status: 401 }
    );
    clearSessionCookie(response);
    return response;
  }

  const token = await createSessionToken({
    sub: session.sub,
    username: session.username,
    full_name: session.full_name,
    role: session.role,
    last_active: Math.floor(Date.now() / 1000),
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
