import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasPermission, type UserRole } from "@/lib/auth/roles";

export interface SessionPayload {
  sub: string;
  username: string;
  full_name: string;
  role: UserRole;
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createServiceClient({ requireServiceRole: true });
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, username, full_name, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile || !profile.is_active) {
      return null;
    }

    return {
      sub: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      role: profile.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function requireSession(options?: {
  roles?: UserRole[];
  permission?: Parameters<typeof hasPermission>[1];
}): Promise<
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse }
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
