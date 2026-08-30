"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkLoginAllowed, forSystem, recordLoginFailure, recordLoginSuccess,
  recordAuthEvent, requestOrigin, isNewOrigin, signInDetail, AUTH_EVENT,
  userRequiresSecondFactor, verifyUserSecondFactor,
} from "@revio/db";
import { sessionTtlSeconds } from "@revio/core";
import { getSession } from "./session";
import {
  verifyPassword, signSession, setSessionCookie, clearSessionCookie,
  signPendingTwoFactor, setPendingTwoFactorCookie, readPendingTwoFactor, clearPendingTwoFactorCookie,
} from "./auth";

// Login resolves a user by email before any tenant context exists → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type LoginResult = { error?: string };

export async function login(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  // Brute-force gate. Checked BEFORE the password, so a locked address never reaches bcrypt — which
  // also sheds the CPU cost an attacker was trying to impose. Counted against the email as typed
  // whether or not it exists, so the lockout message cannot be used to discover who has an account.
  const origin = requestOrigin(await headers());

  const gate = await checkLoginAllowed("cm", email);
  if (!gate.allowed) {
    await recordAuthEvent({ scope: "cm", type: AUTH_EVENT.signInBlocked, email, ...origin, detail: "rate limited" });
    return { error: gate.message };
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    await recordLoginFailure("cm", email);
    // The tenant is recorded only when the address matched a real account. A failure against an
    // unknown address has no tenant, and guessing one would let a hotel read attempts that are not
    // theirs — the RLS policy keeps those rows operator-only for exactly that reason.
    await recordAuthEvent({
      scope: "cm", type: AUTH_EVENT.signInFailed, email,
      userId: user?.id ?? null, tenantId: user?.tenantId ?? null, ...origin,
    });
    return { error: "Invalid email or password." };
  }
  await recordLoginSuccess("cm", email);
  if (user.tenant.status !== "active") return { error: "This account is suspended — contact Revio." };
  if (!user.tenant.hasChannelManager) return { error: "RevioLink isn’t enabled for this hotel." };

  // "Remember me" is a real choice, not a longer default. A shared reception terminal and a
  // manager's own laptop want opposite answers, and the cookie's maxAge must match the token's
  // expiry or the browser keeps a credential the server has already stopped honouring.
  // Checked BEFORE the row is written, or the sign-in we are about to record would itself be the
  // prior visit and every address would look familiar.
  const remembered = fd.get("remember") != null;

  /*
   * SECOND FACTOR — checked BEFORE the sign-in is recorded.
   *
   * A correct password gets a PENDING token, never a session. Issuing a session and then asking for
   * a code on the next screen would mean the password alone had already authenticated somebody:
   * anything reading the cookie rather than the screen would let them straight in.
   *
   * The ordering matters as much as the check. Recording `signIn` first — which is where this used
   * to sit — would write a successful sign-in for somebody who never got past the code, so the auth
   * log would show an entry that did not happen and would hide the one that did: a run of failed
   * second factors against a stolen password, which is precisely what the log exists to surface.
   *
   * Enrolled once on the shared identity, so somebody who turned it on in another Revio product is
   * challenged here too. Skipping it in an app that happens not to host the setup screen would make
   * the protection a fiction.
   */
  if (await userRequiresSecondFactor(user.id)) {
    await setPendingTwoFactorCookie(await signPendingTwoFactor(user.id, remembered));
    redirect("/login/2fa");
  }

  // Checked BEFORE the row is written, or the sign-in we are about to record would itself be the
  // prior visit and every address would look familiar.
  const newOrigin = await isNewOrigin({ userId: user.id }, origin.ip);
  await recordAuthEvent({
    scope: "cm", type: AUTH_EVENT.signIn,
    userId: user.id, tenantId: user.tenantId, email, ...origin,
    detail: signInDetail({ newOrigin, remembered }),
  });

  const ttl = sessionTtlSeconds(remembered);
  await setSessionCookie(await signSession({ kind: "hotel", sub: user.id }, ttl), ttl);
  redirect("/dashboard");
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
  const session = await getSession();
  if (!session) redirect("/login");
  await prisma.user.update({
    where: { id: session.userId },
    data: { sessionsValidFrom: new Date() },
  });
  await clearSessionCookie();
  redirect("/login?signedout=all");
}

/**
 * Step two: exchange a proven second factor for the actual session.
 *
 * Rate-limited on the same gate as the password and keyed by the ACCOUNT rather than a typed email —
 * this step has no email field, and an unlimited six-digit form is a space anybody can walk given
 * time. Being past the password does not buy unlimited attempts at the thing protecting against a
 * stolen password.
 */
export async function verifyTwoFactor(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const pending = await readPendingTwoFactor();
  if (!pending) return { error: "That took too long — please sign in again." };

  const code = String(fd.get("code") ?? "");
  if (!code.trim()) return { error: "Enter the six-digit code from your app, or a recovery code." };

  const gate = await checkLoginAllowed("cm", `2fa:${pending.userId}`);
  if (!gate.allowed) return { error: gate.message };

  const origin = requestOrigin(await headers());
  const result = await verifyUserSecondFactor(pending.userId, code);
  if (!result.ok) {
    await recordLoginFailure("cm", `2fa:${pending.userId}`);
    await recordAuthEvent({
      scope: "cm", type: AUTH_EVENT.twoFactorFailed,
      userId: pending.userId, ...origin, detail: result.error,
    });
    return { error: result.error };
  }
  await recordLoginSuccess("cm", `2fa:${pending.userId}`);

  const user = await prisma.user.findUnique({ where: { id: pending.userId }, include: { tenant: true } });
  if (!user || !user.active || user.tenant.status !== "active") {
    // Re-checked here, not only at the password step: the five minutes between the two screens is
    // long enough for an account to be deactivated, and the pending token proves a password rather
    // than a still-valid account.
    await clearPendingTwoFactorCookie();
    return { error: "This account is no longer active — contact your manager." };
  }

  /*
   * A recovery code is recorded as itself, not as an ordinary sign-in. Somebody using one has lost
   * their authenticator, and a run of them is either a person in trouble or an attacker with a
   * stolen printout — either way it is not a normal Tuesday.
   */
  await recordAuthEvent({
    scope: "cm",
    type: result.usedRecoveryCode ? AUTH_EVENT.recoveryCodeUsed : AUTH_EVENT.twoFactorPassed,
    userId: user.id, tenantId: user.tenantId, email: user.email, ...origin,
    detail: result.usedRecoveryCode
      ? `${result.recoveryCodesRemaining ?? 0} recovery codes left`
      : null,
  });

  await clearPendingTwoFactorCookie();
  const ttl = sessionTtlSeconds(pending.remember);
  await setSessionCookie(await signSession({ kind: "hotel", sub: user.id }, ttl), ttl);
  redirect("/dashboard");
}
