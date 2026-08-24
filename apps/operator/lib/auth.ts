import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_SECONDS } from "@revio/core";

export const SESSION_COOKIE = "revio_op_session";
/**
 * Default session length when nobody asked to be remembered.
 *
 * It used to be a flat seven days for everyone, including the shared terminal at reception where
 * guests are standing. The two values now live in `@revio/core` so the login screen can state the
 * one it is about to apply.
 */
const DEFAULT_TTL_SECONDS = SESSION_TTL_SECONDS.short;

/**
 * The signing key for session cookies — fail-closed.
 *
 * This used to fall back to a hardcoded literal when AUTH_SECRET was unset, which meant a service
 * that lost its env var did not break: it kept serving, signing sessions with a value published in
 * this repository. Anyone could then mint a valid session cookie for any user. A login system whose
 * failure mode is "silently accept forged sessions" is worse than one that refuses to start.
 *
 * So: in production, missing or weak means throw. In development the fallback stays, because a local
 * checkout that will not boot until you invent a secret is a checkout nobody runs.
 */
const MIN_SECRET_LENGTH = 32;

function secret() {
  const value = process.env.AUTH_SECRET;

  if (!value || value.length < MIN_SECRET_LENGTH) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        !value
          ? "AUTH_SECRET is not set. Refusing to sign sessions with a known key — set it on this service."
          : `AUTH_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Use a long random value.`,
      );
    }
    return new TextEncoder().encode("dev-insecure-secret-change-in-prod");
  }

  return new TextEncoder().encode(value);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type SessionPayload = { kind: "hotel" | "operator"; sub: string };

/** A verified token: who it is for, and WHEN it was minted — the second half is what makes a
 *  session revocable without a session table. See `checkSessionValidity` in `@revio/core`. */
export type VerifiedSession = SessionPayload & { issuedAt: number | undefined };

export async function signSession(
  payload: SessionPayload,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret());
}

/**
 * The PREVIOUS signing key, during a rotation (N5).
 *
 * Changing `AUTH_SECRET` invalidates every token signed with the old one, so a plain swap logs out
 * every user of every product at once — mid-shift, at a front desk, with guests waiting. That is a
 * real cost, and it is the reason key rotation gets postponed indefinitely at most companies.
 *
 * With `AUTH_SECRET_PREVIOUS` set, new tokens are signed with the new key and old ones are still
 * accepted, so nobody notices. Remove the variable once the longest session TTL has passed (14 days
 * for "remember me") and the old key is dead.
 *
 * Verification only — never signing. A rotation that kept issuing tokens under the old key would
 * never finish.
 */
function previousSecret(): Uint8Array | null {
  const value = process.env.AUTH_SECRET_PREVIOUS;
  return value && value.length >= MIN_SECRET_LENGTH ? new TextEncoder().encode(value) : null;
}

export async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await verifyWithEitherKey(token);
    if (payload.kind !== "hotel" && payload.kind !== "operator") return null;
    return {
      kind: payload.kind as SessionPayload["kind"],
      sub: String(payload.sub),
      // Carried through rather than discarded: the session check compares it against the account's
      // revocation cutoff. A token without one is rejected there, never quietly accepted.
      issuedAt: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The half-authenticated state between a correct password and a verified second factor (N4).
 *
 * This is deliberately NOT a session. `verifySessionToken` only accepts `kind: "hotel" | "operator"`,
 * so a token minted here is rejected everywhere a session is required — the type system and the
 * verifier both refuse it, rather than it being a session that screens are trusted to guard.
 *
 * Short-lived on purpose: it is issued after a password is proven and before a second factor is,
 * which is the one window where a stolen password is worth something. Five minutes is long enough
 * to find a phone and short enough to be useless later.
 *
 * It carries the "remember me" choice because that was decided on the first screen and must not be
 * silently downgraded by the second.
 */
const PENDING_2FA_COOKIE = "revio_op_2fa";
const PENDING_2FA_TTL_SECONDS = 5 * 60;

export async function signPendingTwoFactor(operatorId: string, remember: boolean): Promise<string> {
  return new SignJWT({ kind: "operator_2fa", sub: operatorId, remember })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + PENDING_2FA_TTL_SECONDS)
    .sign(secret());
}

export async function setPendingTwoFactorCookie(token: string): Promise<void> {
  (await cookies()).set(PENDING_2FA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_2FA_TTL_SECONDS,
  });
}

export async function readPendingTwoFactor(): Promise<{ operatorId: string; remember: boolean } | null> {
  const token = (await cookies()).get(PENDING_2FA_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await verifyWithEitherKey(token);
    if (payload.kind !== "operator_2fa") return null;
    return { operatorId: String(payload.sub), remember: payload.remember === true };
  } catch {
    return null;
  }
}

export async function clearPendingTwoFactorCookie(): Promise<void> {
  (await cookies()).delete(PENDING_2FA_COOKIE);
}

/** Try the current key, then the previous one if a rotation is in progress. */
async function verifyWithEitherKey(token: string) {
  try {
    return await jwtVerify(token, secret());
  } catch (err) {
    const previous = previousSecret();
    if (!previous) throw err;
    return await jwtVerify(token, previous);
  }
}

export async function setSessionCookie(
  token: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  // maxAge must match the token's own expiry, or the cookie outlives the credential and the person
  // gets a silent bounce to /login instead of a session that simply ended.
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });
}
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
