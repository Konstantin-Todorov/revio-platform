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
    pathname.startsWith("/accept-invite/") ||
    // Where Stripe returns the customer's browser after Checkout. The person landing here is a
    // hotel owner who has just paid; they have no operator login and never will, so bouncing them
    // to /login after taking their money would read as the payment having gone wrong. The page
    // shows static copy and looks nothing up, so there is nothing on it to protect.
    pathname === "/paid";
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
   * Three machine endpoints are exempt, for the same reason: the caller is a server with no cookie,
   * and a redirect to /login is not an error it can report — it is a 307 that looks like a success.
   *
   *   api/health  — polled by an EXTERNAL uptime monitor. Following the redirect would report the
   *                 service healthy while its database was unreachable.
   *   api/leads   — the marketing site POSTs a demo request here. Caught by testing the deployed
   *                 endpoint rather than trusting it: it answered 307 to both a missing secret and
   *                 a wrong one, so every lead would have been silently swallowed by the login page
   *                 while the website's own error handling stayed quiet by design.
   *   api/jobs    — the cron runner POSTs here. Missing until 2026-09-07, because the operator had
   *                 never had a scheduled job: `trial-sweep` was the first, and it spent its whole
   *                 life POSTing into the login page. Every other app already exempted `api/jobs`;
   *                 this file described the exact failure above and did not list it.
   *
   *   api/webhooks — Stripe POSTs here to say an invoice has been paid. The same shape as the
   *                 three above, and the same failure if it were missed: a 307 to /login is a 2xx
   *                 to Stripe's retry logic, so every payment would be recorded as delivered while
   *                 no invoice was ever marked paid.
   *
   * None is unguarded. Health returns only up/down; leads and jobs each require a shared secret and
   * refuse outright when one is not configured; the Stripe webhook refuses anything without a valid
   * HMAC signature, and refuses everything when no signing secret is stored.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|api/leads|api/jobs|api/webhooks|.*\\.[a-zA-Z0-9]+$).*)"],
};
