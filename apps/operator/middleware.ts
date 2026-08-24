import { NextResponse, type NextRequest } from "next/server";

// Operator uses its OWN cookie so it never collides with a hotel session (same host, different app).
const SESSION_COOKIE = "revio_op_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Public auth surfaces. A password reset is, by definition, requested by someone who cannot
  // sign in — so these must be reachable without a session or the whole flow is a dead link.
  const isPublic =
    pathname === "/login" ||
    // Step two of signing in: reached with a correct password and no session yet, so requiring one
    // would make two-factor authentication unreachable. It is not unguarded — the page itself
    // demands a valid pending token and sends anyone without one back to the start.
    pathname === "/login/2fa" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname.startsWith("/accept-invite/");
  const isLogin = pathname === "/login";
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // api/health is polled by an EXTERNAL uptime monitor that has no session, so the cookie gate
  // must not redirect it — a monitor following a 307 to /login would report the service
  // healthy while its database was unreachable.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.[a-zA-Z0-9]+$).*)"],
};
