import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syntheticEmail } from "@/lib/auth/portalEmail";
import { getDefaultRouteForRole, type UserRole } from "@/lib/auth/roles";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Enter your username and password." },
        { status: 400 }
      );
    }

    const admin = createServiceClient({ requireServiceRole: true });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, username, full_name, role, is_active")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      console.error("Login profile lookup:", profileError);
      return NextResponse.json(
        { error: "Login failed. Check server configuration." },
        { status: 500 }
      );
    }

    if (!profile || !profile.is_active) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const email = syntheticEmail(username);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    if (authData.user.id !== profile.id) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const role = profile.role as UserRole;

    return NextResponse.json({
      user: {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        role,
      },
      redirectTo: getDefaultRouteForRole(role),
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Login failed. Check server configuration." },
      { status: 500 }
    );
  }
}
