"use server";

import { redirect } from "next/navigation";
import { OPERATOR_LOGIN_GATE } from "@revio/core";
import {
  checkLoginAllowed, forSystem, recordLoginFailure, recordLoginSuccess,
  requiresSecondFactor, verifySecondFactor,
} from "@revio/db";
import { sessionTtlSeconds } from "@revio/core";
import { getOperatorSession } from "./session";
import {
  verifyPassword, signSession, setSessionCookie, clearSessionCookie,
  signPendingTwoFactor, setPendingTwoFactorCookie, readPendingTwoFactor, clearPendingTwoFactorCookie,
} from "./auth";

// Operator login resolves staff before any tenant context → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type LoginResult = { error?: string };

export async function login(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  // Brute-force gate, on the stricter OPERATOR policy — 3 attempts, not 5, and hours rather than
  // minutes at the cap. Not because operators are less trusted, but because one guessed password
  // here reaches every tenant on the platform, and there are only ever a handful of these accounts,
  // so the tighter limit costs nobody anything.
  const gate = await checkLoginAllowed("operator", email, OPERATOR_LOGIN_GATE);
  if (!gate.allowed) return { error: gate.message };

  // `!op.passwordHash` is an invited account nobody has claimed yet. It gets the same answer as a
  // wrong password — saying "this account exists but has no password" would confirm the address and
  // point an attacker at the one account with no password to guess.
  const op = await prisma.operatorUser.findUnique({ where: { email } });
  if (!op || !op.passwordHash || !(await verifyPassword(password, op.passwordHash))) {
    await recordLoginFailure("operator", email, OPERATOR_LOGIN_GATE);
    return { error: "Invalid email or password." };
  }
  await recordLoginSuccess("operator", email);

  const remember = fd.get("remember") != null;

  /*
   * SECOND FACTOR (N4). A correct password gets a PENDING token, never a session.
   *
   * The distinction is the whole feature. Issuing a session and then asking for a code on the next
   * screen would mean the password alone had already authenticated somebody — anything that reads
   * the cookie rather than the screen would let them straight in. `signPendingTwoFactor` mints a
   * different `kind`, which `verifySessionToken` refuses, so there is no session until the code is
   * right.
   */
  if (await requiresSecondFactor(op.id)) {
    await setPendingTwoFactorCookie(await signPendingTwoFactor(op.id, remember));
    redirect("/login/2fa");
  }

  // "Remember me" is a real choice, not a longer default. A shared reception terminal and a
  // manager's own laptop want opposite answers, and the cookie's maxAge must match the token's
  // expiry or the browser keeps a credential the server has already stopped honouring.
  const ttl = sessionTtlSeconds(remember);
  await setSessionCookie(await signSession({ kind: "operator", sub: op.id }, ttl), ttl);
  redirect("/overview");
}

/**
 * Step two: exchange a proven second factor for the actual session.
 *
 * Rate-limited on the same gate as the password, keyed by the account rather than the email typed —
 * this step has no email field, and an unlimited code form is a six-digit space anybody can walk
 * given time. Being past the password does not buy unlimited attempts at the thing protecting
 * against a stolen password.
 */
export async function verifyTwoFactor(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const pending = await readPendingTwoFactor();
  if (!pending) return { error: "That took too long — please sign in again." };

  const code = String(fd.get("code") ?? "");
  if (!code.trim()) return { error: "Enter the six-digit code from your app, or a recovery code." };

  const gate = await checkLoginAllowed("operator", `2fa:${pending.operatorId}`, OPERATOR_LOGIN_GATE);
  if (!gate.allowed) return { error: gate.message };

  const result = await verifySecondFactor(pending.operatorId, code);
  if (!result.ok) {
    await recordLoginFailure("operator", `2fa:${pending.operatorId}`, OPERATOR_LOGIN_GATE);
    return { error: result.error };
  }
  await recordLoginSuccess("operator", `2fa:${pending.operatorId}`);

  await clearPendingTwoFactorCookie();
  const ttl = sessionTtlSeconds(pending.remember);
  await setSessionCookie(await signSession({ kind: "operator", sub: pending.operatorId }, ttl), ttl);
  redirect("/overview");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Sign out of every device, including this one.
 *
 * Moves the account's revocation line to now, which kills every token minted before this instant —
 * the laptop left on a train, the browser on a hotel lobby machine, a session somebody else is
 * holding. It is the only control here that reaches a device we cannot see.
 *
 * The current session goes too, deliberately: an "everywhere" that quietly spares the device you are
 * sitting at is not everywhere, and the person can sign back in in seconds.
 */
export async function signOutEverywhere(): Promise<void> {
  const session = await getOperatorSession();
  if (!session) redirect("/login");
  await prisma.operatorUser.update({
    where: { id: session.userId },
    data: { sessionsValidFrom: new Date() },
  });
  await clearSessionCookie();
  redirect("/login?signedout=all");
}
