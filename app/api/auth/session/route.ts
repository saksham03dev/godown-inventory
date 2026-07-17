import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/api";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
