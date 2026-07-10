import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session-edge";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const response = NextResponse.json(
      { error: "Session expired due to inactivity." },
      { status: 401 }
    );
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json({
    user: {
      id: session.sub,
      username: session.username,
      full_name: session.full_name,
      role: session.role,
    },
  });
}
