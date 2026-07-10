import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function requireAdmin() {
  const session = await getSessionFromCookies();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
