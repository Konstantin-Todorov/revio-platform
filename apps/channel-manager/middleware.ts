import { NextResponse, type NextRequest } from "next/server";

// Edge-safe gate: redirect by session-cookie presence. Full validation happens in getSession (node).
const SESSION_COOKIE = "revio_session";

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
    pathname.startsWith("/accept-invite/") ||
    // Public signup. A hotel that has never heard of us has, by definition, no session — this is
    // the one page on this host meant to be reached from an advert.
    pathname === "/signup" ||
    pathname === "/signup/sent" ||
    pathname === "/signup/existing";
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

/**
 * The paths the cookie gate must not touch, and why each one is on the list.
 *
 * ⚠️ Everything here is reached by something that HAS NO SESSION AND CANNOT GET ONE. A 307 to
 * /login is not an error any of them can report — a cron sees a redirect it ignores, a mail client
 * shows a broken image, a monitor follows the redirect and calls the service healthy. The failure is
 * always silent, which is why the list is written out rather than kept in the regex alone.
 */
const UNGATED = [
  // Cron. Does its own Bearer auth against CRON_SECRET.
  "api/jobs",
  // A hotel's email logo, fetched by mail clients that carry no cookie at all.
  "api/brand",
  // Polled by an EXTERNAL uptime monitor. A monitor following a 307 to /login would report the
  // service healthy while its database was unreachable.
  "api/health",
  /*
   * ⚠️ Channex ringing us when a booking arrives. Added 2026-09-17, and it was missing on the first
   * deploy of that endpoint — caught by curl-ing production and getting a 307 instead of a 401.
   *
   * It would have failed in the worst available way: Channex gets a redirect, the route never runs,
   * and it eventually disables an endpoint that keeps failing — while bookings carry on arriving on
   * the five-minute poll, so nobody would ever have noticed the webhook did not work. The route does
   * its own shared-secret check and fails closed.
   */
  "api/webhooks",
];

export const config = {
  matcher: [`/((?!_next/static|_next/image|favicon.ico|${UNGATED.join("|")}|.*\\.[a-zA-Z0-9]+$).*)`],
};
