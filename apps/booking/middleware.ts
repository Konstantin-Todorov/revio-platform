import { NextResponse, type NextRequest } from "next/server";

/**
 * One opaque id per browsing session, so a hotel's own conversion rate is not half the truth.
 *
 * ## Why the booking engine — the one app with no login — needs a cookie at all
 *
 * The engine takes a hold the moment a guest opens a booking form. A guest who opens the Deluxe,
 * goes back, and books the Standard leaves the Deluxe hold to expire — so one person making one
 * booking is recorded as one conversion AND one abandonment. Counted that way the hotel's
 * direct-booking conversion rate reads at roughly half of what it is, which is worse than not
 * measuring: it argues against the product on the product's own screen.
 *
 * This id is what lets those two holds be recognised as one decision. See `bookingFunnel` in
 * `@revio/core`.
 *
 * ## What it is, and deliberately is not
 *
 * A random opaque id and nothing else — no name, no email, no IP, no fingerprint, nothing derived
 * from the guest. It is first-party, `httpOnly` (so no script on the page can read it), `sameSite:
 * lax`, and it **expires in a day**: long enough to join up one evening of deciding where to stay,
 * far too short to follow anyone. It is never read across hotels for comparison and never leaves
 * our own origin, so it is a functional cookie rather than a tracking one — which is what keeps
 * the engine's "we ask for nothing we do not need" posture true rather than merely claimed.
 *
 * Set here rather than in the page because a React Server Component can read cookies and cannot
 * write them; middleware is the only place that sees every entry point into the engine.
 */
export const BOOKING_SESSION_COOKIE = "revio_bk";

const ONE_DAY_SECONDS = 60 * 60 * 24;

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (req.cookies.get(BOOKING_SESSION_COOKIE)) return res;

  res.cookies.set(BOOKING_SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    // Plain HTTP in local development, or the cookie never arrives and every page looks like a
    // first visit — which is exactly the bug this exists to prevent, hidden behind a dev-only flag.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_DAY_SECONDS,
  });
  return res;
}

export const config = {
  // Pages only. Static assets and images have no session to belong to, and setting a cookie on
  // every photograph would be a cookie header on every request for no gain.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\..*).*)"],
};
