import { NextResponse } from "next/server";
import { getSessionFromCookies, type SessionPayload } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/roles";

export async function requireSession(options?: {
  roles?: UserRole[];
  permission?: Parameters<typeof hasPermission>[1];
}): Promise<
  { session: SessionPayload; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (options?.roles && !options.roles.includes(session.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  if (options?.permission && !hasPermission(session.role, options.permission)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

export async function requireAdmin() {
  const result = await requireSession({ roles: ["admin"] });
  if (result.error) return { error: result.error };
  return { session: result.session };
}
