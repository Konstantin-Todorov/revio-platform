/**
 * The two flows a person actually goes through: "I've been invited" and "I've forgotten my password".
 *
 * Shared rather than written four times, because these are the places where a subtle difference
 * between apps becomes a security hole — one app that says "no account found" undoes the enumeration
 * protection in the other three.
 *
 * Hotel staff (`User`) and our own staff (`OperatorUser`) live in different tables and get the
 * identical treatment; `scope` selects which.
 */
import bcrypt from "bcryptjs";
import { validatePassword, inviteEmail, passwordResetEmail, passwordChangedEmail } from "@revio/core";
import { isBreachedPassword, breachMessage } from "@revio/core/server";
import { forSystem } from "./rls.js";
import { recordAuthEvent, AUTH_EVENT, type AuthEventScope } from "./auth-events.js";
import { issueToken, resolveToken, consumeToken, revokeTokensFor } from "./auth-tokens.js";
import { checkLoginAllowed, recordLoginFailure, type LoginScope } from "./login-gate.js";

/** Which app is asking. Determines the user table and the wording's "context". */
export type AuthScope = "cm" | "crs" | "pms" | "operator";

const isOperator = (scope: AuthScope) => scope === "operator";

export interface SendableEmail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Ask for a reset link.
 *
 * **Always returns the same thing.** Whether the address belongs to an account, belongs to a
 * deactivated account, or has never been seen, the caller gets `{ sent: true }` and shows one
 * message. Anything else turns this form into a directory of who works at a hotel.
 *
 * The email to actually send comes back rather than being sent here, so the caller — which knows its
 * own transport and origin — does it. Returns `email: null` when there is nothing to send; the
 * caller must not let that difference reach the screen.
 */
export async function requestPasswordReset(args: {
  scope: AuthScope;
  email: string;
  /** Absolute origin of the app, e.g. https://reservation-production.up.railway.app */
  origin: string;
  /** "Hotel Sofia" or "the Revio operator console" — appears in the mail. */
  contextName: string;
}): Promise<{ email: SendableEmail | null; throttled: boolean }> {
  const prisma = forSystem();
  const address = args.email.trim().toLowerCase();
  if (!address) return { email: null, throttled: false };

  // Throttled per address, so this cannot be used to bomb someone's inbox or to bury a genuine
  // "your password was changed" alert under a hundred identical mails.
  const gateScope = `reset-${args.scope}` as LoginScope;
  const gate = await checkLoginAllowed(gateScope, address);
  if (!gate.allowed) return { email: null, throttled: true };
  await recordLoginFailure(gateScope, address);

  let name: string | undefined;
  let userId: string | undefined;
  let operatorUserId: string | undefined;

  if (isOperator(args.scope)) {
    const op = await prisma.operatorUser.findUnique({ where: { email: address } });
    if (!op) return { email: null, throttled: false };
    name = op.name ?? undefined;
    operatorUserId = op.id;
  } else {
    const user = await prisma.user.findUnique({ where: { email: address }, include: { tenant: true } });
    // A suspended hotel gets no reset link. Restoring access to a locked account is a conversation
    // with us, not a self-service flow.
    if (!user || !user.active || user.tenant.status !== "active") return { email: null, throttled: false };
    name = user.name ?? undefined;
    userId = user.id;
  }

  const token = await issueToken({
    purpose: "reset",
    email: address,
    ...(userId ? { userId } : {}),
    ...(operatorUserId ? { operatorUserId } : {}),
  });

  const mail = passwordResetEmail({
    ...(name ? { name } : {}),
    context: args.contextName,
    url: `${args.origin.replace(/\/$/, "")}/reset-password/${token}`,
  });

  return { email: { to: address, ...mail }, throttled: false };
}

/**
 * Create a staff account with **no password**, and return the invitation to send.
 *
 * The account cannot be signed into until the invitee chooses a password — which is the entire
 * point. Nobody, including whoever created the account, ever knows their password.
 */
export async function inviteStaff(args: {
  scope: AuthScope;
  email: string;
  name: string;
  origin: string;
  contextName: string;
  invitedBy?: string;
  /** Called with the created account's id so the caller can apply roles/tenancy. */
  createAccount: (email: string, name: string) => Promise<{ id: string }>;
}): Promise<{ email: SendableEmail }> {
  const address = args.email.trim().toLowerCase();
  const account = await args.createAccount(address, args.name);

  const token = await issueToken({
    purpose: "invite",
    email: address,
    ...(isOperator(args.scope) ? { operatorUserId: account.id } : { userId: account.id }),
  });

  const mail = inviteEmail({
    name: args.name,
    context: args.contextName,
    ...(args.invitedBy ? { invitedBy: args.invitedBy } : {}),
    url: `${args.origin.replace(/\/$/, "")}/accept-invite/${token}`,
  });

  return { email: { to: address, ...mail } };
}

export type SetPasswordResult =
  | {
      ok: true;
      email: SendableEmail | null;
      /**
       * The address whose password was just set — NOT the same thing as `email` above, which is the
       * confirmation message to send. The caller needs this to hand the login screen a pre-filled
       * address, so the browser's password manager is offered the same pair it was just shown.
       */
      accountEmail: string;
    }
  | { ok: false; message: string };

/**
 * Spend an invite or reset token and set the chosen password.
 *
 * Order matters and is deliberate: validate the password first (so a bad password does not burn the
 * link), then consume the token, then write the hash. `consumeToken` is the atomic step — if two
 * submissions race, exactly one gets past it.
 */
export async function completePasswordSet(args: {
  token: string;
  purpose: "invite" | "reset";
  password: string;
  contextName: string;
}): Promise<SetPasswordResult> {
  const resolved = await resolveToken(args.token, args.purpose);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const strength = validatePassword(args.password, { email: resolved.token.email });
  if (!strength.ok) return { ok: false, message: strength.message };

  /*
   * The breach check (N5), and this is the ONLY place it runs.
   *
   * Checked when a password is CHOSEN, never at sign-in: sign-in must not depend on an outbound
   * request, and blocking somebody at the door does not improve a password they already have.
   *
   * It fails open — an outage at Have I Been Pwned must not stop a hotel's new manager finishing
   * their invitation. `skipped` says so rather than pretending the answer was "clean".
   */
  const breach = await isBreachedPassword(args.password);
  if (breach.breached) return { ok: false, message: breachMessage(breach.count) };

  // Atomic: the loser of a race gets this, not a second password write.
  if (!(await consumeToken(resolved.token.id))) {
    return { ok: false, message: "This link has already been used." };
  }

  const prisma = forSystem();
  const passwordHash = await bcrypt.hash(args.password, 10);
  let name: string | undefined;

  /**
   * Changing the password ends every session that existed before it.
   *
   * Without this the flow is theatre in the case it exists for: someone whose password was stolen
   * resets it, feels safe, and the thief's seven-day token keeps working. The person doing the reset
   * is not signed in on this device (they got here from an emailed link), so nothing they are using
   * is interrupted — and `checkSessionValidity` treats the same second as still valid anyway.
   */
  const sessionsValidFrom = new Date();

  // Recorded whether the password was set for the first time or reset (N5). A password change ends
  // every existing session, so it is the most consequential thing that can happen to an account
  // without anybody signing in — and the row that explains why somebody was logged out.
  // `account`, not an app: a hotel identity signs into three products with one password, and this
  // change ends the sessions of all of them.
  const scope: AuthEventScope = resolved.token.operatorUserId ? "operator" : "account";

  if (resolved.token.operatorUserId) {
    const op = await prisma.operatorUser.update({
      where: { id: resolved.token.operatorUserId },
      data: { passwordHash, sessionsValidFrom },
    });
    name = op.name ?? undefined;
    await recordAuthEvent({
      scope, type: AUTH_EVENT.passwordChanged,
      operatorUserId: op.id, email: resolved.token.email,
      detail: resolved.token.purpose === "invite" ? "set from invitation" : "reset",
    });
  } else if (resolved.token.userId) {
    const user = await prisma.user.update({
      where: { id: resolved.token.userId },
      data: { passwordHash, sessionsValidFrom },
    });
    name = user.name ?? undefined;
    await recordAuthEvent({
      scope, type: AUTH_EVENT.passwordChanged,
      userId: user.id, tenantId: user.tenantId, email: resolved.token.email,
      detail: resolved.token.purpose === "invite" ? "set from invitation" : "reset",
    });
  } else {
    return { ok: false, message: "This link is not attached to an account." };
  }

  // Every other outstanding link for this address dies with the password change. A reset requested
  // by an attacker minutes earlier must not still work after the real owner recovers the account.
  await revokeTokensFor(resolved.token.email);

  // Only on a RESET. Telling someone their password changed right after they set it up for the first
  // time is noise; telling them after a reset is how a stolen account gets noticed.
  const notice =
    args.purpose === "reset"
      ? { to: resolved.token.email, ...passwordChangedEmail({ ...(name ? { name } : {}), context: args.contextName }) }
      : null;

  return { ok: true, email: notice, accountEmail: resolved.token.email };
}
