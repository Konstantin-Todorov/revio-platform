"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkLoginAllowed, forSystem, recordLoginFailure, recordLoginSuccess,
  recordAuthEvent, requestOrigin, AUTH_EVENT,
} from "@revio/db";
import { sessionTtlSeconds } from "@revio/core";
import { getSession } from "./session";
import { verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "./auth";

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
  await recordAuthEvent({
    scope: "cm", type: AUTH_EVENT.signIn,
    userId: user.id, tenantId: user.tenantId, email, ...origin,
  });

  const ttl = sessionTtlSeconds(fd.get("remember") != null);
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
