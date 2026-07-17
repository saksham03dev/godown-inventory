import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/api";

/** Keep client idle timeout in sync — Auth cookies refresh via middleware. */
export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
