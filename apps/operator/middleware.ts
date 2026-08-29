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
  /*
   * Two machine endpoints are exempt, for the same reason: the caller is a server with no cookie,
   * and a redirect to /login is not an error it can report — it is a 307 that looks like a success.
   *
   *   api/health  — polled by an EXTERNAL uptime monitor. Following the redirect would report the
   *                 service healthy while its database was unreachable.
   *   api/leads   — the marketing site POSTs a demo request here. Caught by testing the deployed
   *                 endpoint rather than trusting it: it answered 307 to both a missing secret and
   *                 a wrong one, so every lead would have been silently swallowed by the login page
   *                 while the website's own error handling stayed quiet by design.
   *
   * Neither is unguarded. Health returns only up/down; leads requires a shared secret and refuses
   * outright when one is not configured.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|api/leads|.*\\.[a-zA-Z0-9]+$).*)"],
};
