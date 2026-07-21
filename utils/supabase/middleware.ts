import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  BILLING_ENABLED,
  isBillingApiPath,
  isBillingPagePath,
} from "@/lib/constants/features";
import {
  canAccessRoute,
  getDefaultRouteForRole,
  type UserRole,
} from "@/lib/auth/roles";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/bootstrap",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export const updateSession = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    if (!isPublicPath(pathname) && !pathname.startsWith("/api/auth")) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let isActive = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_active) {
      role = profile.role as UserRole;
      isActive = true;
    }
  }

  const authenticated = Boolean(user && isActive && role);

  if (!authenticated && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (authenticated && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = getDefaultRouteForRole(role!);
    const redirect = NextResponse.redirect(homeUrl);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value);
    });
    return redirect;
  }

  if (authenticated && role && !isPublicPath(pathname)) {
    if (role === "employee" && pathname === "/") {
      const scanUrl = request.nextUrl.clone();
      scanUrl.pathname = getDefaultRouteForRole(role);
      const redirect = NextResponse.redirect(scanUrl);
      supabaseResponse.cookies.getAll().forEach((c) => {
        redirect.cookies.set(c.name, c.value);
      });
      return redirect;
    }

    if (!BILLING_ENABLED && pathname === "/scan") {
      const stockInUrl = request.nextUrl.clone();
      stockInUrl.pathname = getDefaultRouteForRole(role);
      const redirect = NextResponse.redirect(stockInUrl);
      supabaseResponse.cookies.getAll().forEach((c) => {
        redirect.cookies.set(c.name, c.value);
      });
      return redirect;
    }

    if (
      !BILLING_ENABLED &&
      (isBillingPagePath(pathname) || isBillingApiPath(pathname))
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Billing is disabled in stock-only mode." },
          { status: 404 }
        );
      }
      const fallbackUrl = request.nextUrl.clone();
      fallbackUrl.pathname = getDefaultRouteForRole(role);
      const redirect = NextResponse.redirect(fallbackUrl);
      supabaseResponse.cookies.getAll().forEach((c) => {
        redirect.cookies.set(c.name, c.value);
      });
      return redirect;
    }

    if (!canAccessRoute(pathname, role)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const fallbackUrl = request.nextUrl.clone();
      fallbackUrl.pathname = getDefaultRouteForRole(role);
      const redirect = NextResponse.redirect(fallbackUrl);
      supabaseResponse.cookies.getAll().forEach((c) => {
        redirect.cookies.set(c.name, c.value);
      });
      return redirect;
    }
  }

  return supabaseResponse;
};
