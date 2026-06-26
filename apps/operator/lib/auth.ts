import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "revio_op_session";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret-change-in-prod");
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
