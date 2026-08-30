import {
  beginEnrolment, confirmEnrolment, verifySecond, disable, isEnabled,
  type ConfirmResult, type EnrolmentOffer, type SecondFactorResult,
} from "./two-factor.js";
import { userTwoFactorStore, tenantUserTwoFactorStore } from "./two-factor-stores.js";
import { recordAuthEvent, AUTH_EVENT, type AuthEventScope } from "./auth-events.js";

/**
 * Two-factor authentication for a HOTEL staff account.
 *
 * ## One identity, three products
 *
 * A hotel person has ONE account across RevioLink, RevioCRS and RevioPMS, so this is enrolled once
 * and applies to all three — the same property `sessionsValidFrom` already has. Three per-app
 * secrets would be three chances to leave one unprotected while the hotel believed it was covered,
 * and the account is one person either way.
 *
 * The `scope` argument is only which product they happened to be looking at when they did it, for
 * the audit line. It never changes what is protected.
 *
 * ## Which perimeter, and why it differs by call
 *
 * Sign-in uses the system perimeter because it happens BEFORE any tenant context exists — working
 * out who this is *is* the step. Everything a signed-in person does to their own account uses the
 * tenant perimeter, because by then the tenant is known and a hotel must only ever reach its own
 * people. See `two-factor-stores.ts`.
 */

export type { ConfirmResult, EnrolmentOffer, SecondFactorResult };

/** Enrolment and management: the caller has a session, so the tenant is known and is enforced. */
export function beginUserTotpEnrolment(
  tenantId: string,
  userId: string,
  issuer: string,
): Promise<EnrolmentOffer> {
  return beginEnrolment(tenantUserTwoFactorStore(tenantId), userId, issuer);
}

export async function confirmUserTotpEnrolment(
  args: { tenantId: string; userId: string; code: string; scope: AuthEventScope; email?: string },
  now = Date.now(),
): Promise<ConfirmResult> {
  const result = await confirmEnrolment(
    tenantUserTwoFactorStore(args.tenantId),
    args.userId,
    args.code,
    now,
  );
  if (result.ok) {
    await recordAuthEvent({
      scope: args.scope, type: AUTH_EVENT.twoFactorEnabled,
      userId: args.userId, tenantId: args.tenantId, email: args.email ?? null,
      detail: `${result.recoveryCodes?.length ?? 0} recovery codes issued · protects every Revio product`,
    });
  }
  return result;
}

export async function disableUserTotp(args: {
  tenantId: string;
  userId: string;
  scope: AuthEventScope;
  email?: string;
}): Promise<void> {
  await disable(tenantUserTwoFactorStore(args.tenantId), args.userId);
  // The event most worth having: it is what somebody who has stolen the password would do next, and
  // the only trace it otherwise leaves is an absence.
  await recordAuthEvent({
    scope: args.scope, type: AUTH_EVENT.twoFactorDisabled,
    userId: args.userId, tenantId: args.tenantId, email: args.email ?? null,
  });
}

/** Sign-in: no session yet, so no tenant. See the note above. */
export function verifyUserSecondFactor(
  userId: string,
  submitted: string,
  now = Date.now(),
): Promise<SecondFactorResult> {
  return verifySecond(userTwoFactorStore(), userId, submitted, now);
}

export function userRequiresSecondFactor(userId: string): Promise<boolean> {
  return isEnabled(userTwoFactorStore(), userId);
}
