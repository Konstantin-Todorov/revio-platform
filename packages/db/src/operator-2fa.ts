import {
  beginEnrolment, confirmEnrolment, verifySecond, disable, isEnabled,
  type ConfirmResult, type EnrolmentOffer, type SecondFactorResult,
} from "./two-factor.js";
import { operatorTwoFactorStore } from "./two-factor-stores.js";
import { recordAuthEvent, AUTH_EVENT } from "./auth-events.js";

/**
 * Two-factor authentication for the Operator console (N4).
 *
 * The console reads every hotel's data and holds their OTA credentials, so one guessed or reused
 * password there reaches the entire platform. It is the account set where a second factor is most
 * worth the friction and — being a handful of people — where the friction costs least.
 *
 * ⚠️ **The implementation moved to `two-factor.ts` when hotel accounts needed the same thing.** This
 * file is now the operator's thin binding: the store it uses, and the audit events that are specific
 * to an operator. Nothing security-significant is decided here any more — replay refusal, hashing
 * cost and the recovery-code rules all live in one place, so the two account types cannot drift into
 * having different protections.
 */

export type { ConfirmResult, EnrolmentOffer, SecondFactorResult };

export function beginTotpEnrolment(operatorUserId: string, issuer = "Revio Operator"): Promise<EnrolmentOffer> {
  return beginEnrolment(operatorTwoFactorStore(), operatorUserId, issuer);
}

export async function confirmTotpEnrolment(
  operatorUserId: string,
  code: string,
  now = Date.now(),
): Promise<ConfirmResult> {
  const result = await confirmEnrolment(operatorTwoFactorStore(), operatorUserId, code, now);
  if (result.ok) {
    await recordAuthEvent({
      scope: "operator", type: AUTH_EVENT.twoFactorEnabled, operatorUserId,
      detail: `${result.recoveryCodes?.length ?? 0} recovery codes issued`,
    });
  }
  return result;
}

export function verifySecondFactor(
  operatorUserId: string,
  submitted: string,
  now = Date.now(),
): Promise<SecondFactorResult> {
  return verifySecond(operatorTwoFactorStore(), operatorUserId, submitted, now);
}

export async function disableTotp(operatorUserId: string): Promise<void> {
  await disable(operatorTwoFactorStore(), operatorUserId);
  // Turning the second factor OFF is the event most worth having: it is what an attacker who has the
  // password would do next, and the only trace it otherwise leaves is an absence.
  await recordAuthEvent({ scope: "operator", type: AUTH_EVENT.twoFactorDisabled, operatorUserId });
}

export function requiresSecondFactor(operatorUserId: string): Promise<boolean> {
  return isEnabled(operatorTwoFactorStore(), operatorUserId);
}
