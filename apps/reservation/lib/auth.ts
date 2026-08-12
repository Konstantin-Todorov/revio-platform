import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "revio_crs_session";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

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

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SECONDS)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== "hotel" && payload.kind !== "operator") return null;
    return { kind: payload.kind as SessionPayload["kind"], sub: String(payload.sub) };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
