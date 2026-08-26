"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkLoginAllowed, forSystem, recordLoginFailure, recordLoginSuccess,
  recordAuthEvent, requestOrigin, isNewOrigin, signInDetail, AUTH_EVENT,
} from "@revio/db";
import { sessionTtlSeconds } from "@revio/core";
import { getSession } from "./session";
import { verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "./auth";
import { roleHome } from "./roles";

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

  const gate = await checkLoginAllowed("pms", email);
  if (!gate.allowed) {
    await recordAuthEvent({ scope: "pms", type: AUTH_EVENT.signInBlocked, email, ...origin, detail: "rate limited" });
    return { error: gate.message };
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    await recordLoginFailure("pms", email);
    // The tenant is recorded only when the address matched a real account. A failure against an
    // unknown address has no tenant, and guessing one would let a hotel read attempts that are not
    // theirs — the RLS policy keeps those rows operator-only for exactly that reason.
    await recordAuthEvent({
      scope: "pms", type: AUTH_EVENT.signInFailed, email,
      userId: user?.id ?? null, tenantId: user?.tenantId ?? null, ...origin,
    });
    return { error: "Invalid email or password." };
  }
  await recordLoginSuccess("pms", email);
  if (user.tenant.status !== "active") return { error: "This account is suspended — contact Revio." };
  if (!user.tenant.hasPms) return { error: "RevioPMS isn’t enabled for this hotel." };

  // "Remember me" is a real choice, not a longer default. A shared reception terminal and a
  // manager's own laptop want opposite answers, and the cookie's maxAge must match the token's
  // expiry or the browser keeps a credential the server has already stopped honouring.
  // Checked BEFORE the row is written, or the sign-in we are about to record would itself be the
  // prior visit and every address would look familiar.
  const newOrigin = await isNewOrigin({ userId: user.id }, origin.ip);
  const remembered = fd.get("remember") != null;
  await recordAuthEvent({
    scope: "pms", type: AUTH_EVENT.signIn,
    userId: user.id, tenantId: user.tenantId, email, ...origin,
    detail: signInDetail({ newOrigin, remembered }),
  });

  const ttl = sessionTtlSeconds(fd.get("remember") != null);
  await setSessionCookie(await signSession({ kind: "hotel", sub: user.id }, ttl), ttl);

  /*
   * Land on the screen this role is actually allowed to see.
   *
   * This used to be a flat `redirect("/dashboard")`, which a scoped role may not open — so the
   * protected layout immediately redirected AGAIN to `roleHome(role)`. A redirect chained off a
   * server action's redirect leaves the client with an RSC payload it cannot apply, and the symptom
   * is a **white screen that comes right on a manual reload**: reported from real use, signing in as
   * a new housekeeping account.
   *
   * The layout guard stays where it is — it is what stops a housekeeper reaching /dashboard by
   * typing the URL, which is an ordinary navigation and redirects cleanly. It just should never have
   * been the thing deciding where sign-in lands.
   */
  redirect(roleHome(user.role));
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
