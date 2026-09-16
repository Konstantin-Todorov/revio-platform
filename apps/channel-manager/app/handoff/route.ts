import { NextResponse, type NextRequest } from "next/server";
import {
  consumeHandoff, checkLoginAllowed, recordLoginFailure, recordLoginSuccess,
  recordAuthEvent, requestOrigin, forSystem, AUTH_EVENT,
} from "@revio/db";
import { loginDestination, checkSessionValidity, relativeLocation } from "@revio/core";
import { signSession, setSessionCookie } from "@/lib/auth";


/**
 * Arrive here already signed in to another product.
 *
 * ## What this is
 *
 * The receiving half of central login. A hotel that owns two or three products signed in once; the
 * product they came from minted a 30-second, single-use hand-off bound to THIS product, and this
 * route spends it and issues a normal session cookie. From here on nothing is special — the same
 * cookie, the same revocation, the same role checks as a password sign-in.
 *
 * ## ⚠️ It does not ask for a second factor, and that is deliberate
 *
 * Reading that line cold, it sounds like a hole. It is the opposite: **the second factor was already
 * provided.** A hand-off can only be minted by an app that already holds a valid session, and that
 * session could only exist if the password and, where enabled, the TOTP code were both accepted.
 * Asking again at each origin would mean a hotel with three products types three codes from one
 * phone to do one morning's work, and people who are asked that eventually turn the factor off —
 * which is a real loss of security bought with a false one.
 *
 * What makes it safe is the credential's shape rather than a second prompt: single use, thirty
 * seconds, bound to one account AND one product, stored only as a hash, invalidated on issue of the
 * next. Those are the four properties `docs/specs/CENTRAL-LOGIN-DESIGN.md` requires.
 *
 * ## Everything the password door checks, this door checks too
 *
 * A hand-off is not a way around the refusals. The account must still be active, the tenant must
 * still be active, the session must not have been revoked since, and the entitlement must still be
 * held — all re-read HERE, from the database, at the moment of arrival. A hotel whose RevioPMS trial
 * ended while they were reading RevioCRS does not get in because a token said so.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const origin = requestOrigin(req.headers);
  /*
   * ⚠️ RELATIVE Locations, never `new URL(path, req.nextUrl.origin)`.
   *
   * Behind Railway's proxy the Node server sees `http://localhost:<port>/...`, so `req.nextUrl.origin`
   * IS that internal address. Redirecting to it sent a hotel switching from RevioLink to RevioPMS
   * to `localhost:3003` — the hand-off had worked; the arrival redirect was wrong. All four
   * `logout/route.ts` files already warned about exactly this; this route was written later and did
   * it anyway.
   */
  const toLogin = (error: string) =>
    new NextResponse(null, { status: 307, headers: { Location: relativeLocation("/login", { error }) } });

  /*
   * ⚠️ Rate-limited like a password form, because it IS one.
   *
   * A token in a query string is guessable in principle, and an endpoint that turns a string into a
   * session is exactly what a script would hammer. The gate is keyed on the caller's address rather
   * than an account, because a hand-off attempt names no account until it has already succeeded.
   */
  const gate = await checkLoginAllowed("cm", `handoff:${origin.ip ?? "unknown"}`);
  if (!gate.allowed) {
    return toLogin("Too many attempts. Wait a moment and sign in normally.");
  }

  const result = await consumeHandoff(token, "cm");
  if (!result.ok) {
    await recordLoginFailure("cm", `handoff:${origin.ip ?? "unknown"}`);
    return toLogin(result.message);
  }

  // Re-read the account rather than trusting anything the token implied about it.
  const user = await forSystem().user.findUnique({
    where: { id: result.userId },
    include: { tenant: true },
  });
  if (!user || !user.active || user.tenant.status !== "active") {
    return toLogin("That account cannot sign in. Contact an owner at your hotel.");
  }
  // "Sign out everywhere" and a password change both move `sessionsValidFrom`. A hand-off minted a
  // moment before either must not outlive it.
  if (!checkSessionValidity({ issuedAt: Math.floor(Date.now() / 1000), sessionsValidFrom: user.sessionsValidFrom, active: user.active }).ok) {
    return toLogin("Your sessions were signed out. Sign in again.");
  }

  /*
   * The SAME decision the password door makes — `loginDestination`, tested across all 64
   * combinations of entitlement and request. A hand-off must never be a second opinion about who may
   * open what; if it were, the two doors would drift and the quiet one would be the permissive one.
   */
  const decision = loginDestination({
    tenantStatus: user.tenant.status,
    entitlements: {
      cm: user.tenant.hasChannelManager,
      crs: user.tenant.hasReservation,
      pms: user.tenant.hasPms,
    },
    requested: "cm",
  });
  if (decision.kind !== "open") {
    // Not "unauthorised": they are a real customer whose product is locked or elsewhere, and the
    // locked screen inside the app says which of the three situations it is.
    return toLogin("RevioLink is not open on this account right now.");
  }

  await recordAuthEvent({
    scope: "cm",
    type: AUTH_EVENT.signIn,
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    ...origin,
    // Named in the audit trail. A sign-in nobody typed a password for must be distinguishable from
    // one they did, or the log stops answering "how did this session start".
    detail: "opened from another product (central login hand-off)",
  });
  await recordLoginSuccess("cm", `handoff:${origin.ip ?? "unknown"}`);

  /*
   * ⚠️ A short session, NOT a remembered one.
   *
   * "Remember me" is a choice somebody makes at a password box for a device they trust. Nobody made
   * it here, and inheriting 14 days from a click would quietly turn a shared front-desk terminal
   * into a fortnight-long session.
   */
  const ttl = 12 * 60 * 60;
  const res = new NextResponse(null, { status: 307, headers: { Location: relativeLocation("/dashboard") } });
  await setSessionCookie(await signSession({ kind: "hotel", sub: user.id }, ttl), ttl);
  // The spent token is in this URL. Keep it out of the next page's referrer.
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
