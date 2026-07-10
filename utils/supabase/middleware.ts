import { type NextRequest, NextResponse } from "next/server";
import { canAccessRoute, type UserRole } from "@/lib/auth/roles";
import { SESSION_COOKIE, verifySessionToken, clearSessionCookie } from "@/lib/auth/session-edge";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/auth/users"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function redirectToLogin(request: NextRequest, clearCookie: boolean) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  if (clearCookie) {
    loginUrl.searchParams.set("timeout", "1");
  }
  const response = NextResponse.redirect(loginUrl);
  if (clearCookie) {
    clearSessionCookie(response);
  }
  return response;
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

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let session = null;

  if (token && process.env.AUTH_SECRET) {
    session = await verifySessionToken(token);
  }

  const hadStaleSession = Boolean(token && !session);

  if (!session && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      if (hadStaleSession) clearSessionCookie(response);
      return response;
    }
    return redirectToLogin(request, hadStaleSession);
  }

  if (session && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  if (session && !isPublicPath(pathname)) {
    const role = session.role as UserRole;
    if (!canAccessRoute(pathname, role)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
};
