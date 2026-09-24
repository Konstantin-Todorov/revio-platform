import { NextResponse, type NextRequest } from "next/server";

// Edge-safe gate: redirect by session-cookie presence. Full validation happens in getSession (node).
const SESSION_COOKIE = "revio_crs_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Public auth surfaces. A password reset is, by definition, requested by someone who cannot
  // sign in — so these must be reachable without a session or the whole flow is a dead link.
  const isPublic =
    pathname === "/login" ||
    /*
     * ⚠️ Central login's front door, and it MUST be public.
     *
     * A hand-off arrives from another product carrying a 30-second single-use token and no cookie
     * for this origin — that is the entire point. Gating it on a session would bounce it to /login,
     * which is precisely the second sign-in central login exists to remove.
     *
     * It is not unguarded: the route rate-limits by address, spends the token exactly once, and then
     * re-reads the account, the tenant, the revocation stamp and the entitlement from the database
     * before it issues anything.
     */
    pathname === "/handoff" ||
    // Step two of signing in: reached with a correct password and NO session yet, so requiring one
    // would make two-factor authentication unreachable. It is not unguarded — the page demands a
    // valid pending token and sends anyone without one back to the start.
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
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // api/public (booking-engine seam) + api/jobs (cron, Bearer-gated) do their own auth — the
  // session-cookie gate must not redirect them to /login.
  // api/health is polled by an EXTERNAL uptime monitor that has no session, so the cookie gate
  // must not redirect it — a monitor following a 307 to /login would report the service
  // healthy while its database was unreachable.
  // api/brand serves a hotel's email logo to mail clients, which carry no cookie at all — gated, it
  // answered every inbox with a redirect to /login and the logo rendered broken. Same as RevioLink.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public|api/jobs|api/health|api/brand|.*\\.[a-zA-Z0-9]+$).*)"],
};
