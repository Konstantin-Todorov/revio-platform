import bcrypt from "bcryptjs";
import {
  generateTotpSecret,
  generateRecoveryCodes,
  normaliseRecoveryCode,
  totpUri,
  verifyTotp,
  TOTP_PERIOD_SECONDS,
} from "@revio/core/server";
import { forSystem } from "./rls.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

/**
 * Two-factor authentication for the Operator console (N4).
 *
 * The console reads every hotel's data and holds their OTA credentials, so one guessed or reused
 * password there reaches the entire platform. It is the account set where a second factor is most
 * worth the friction and — being a handful of people — where the friction costs least.
 *
 * The RFC-verified maths lives in `@revio/core/server`; this is the part that touches storage, and
 * everything here runs on the SYSTEM perimeter because `OperatorUser` is operator-only by policy.
 */

/** Cost 10 matches the password hashing already in use; a recovery code deserves the same. */
const BCRYPT_COST = 10;

export interface EnrolmentOffer {
  /** Base32, shown for manual entry into an authenticator app. */
  secret: string;
  /** `otpauth://` for the QR code. */
  uri: string;
}

/**
 * Begin enrolment: mint a secret and hand back what the app needs to add the account.
 *
 * The secret is stored immediately but 2FA stays **off** until a code is confirmed. Storing it
 * later would mean holding it in a form field or a session across the round trip; enabling it now
 * would lock the operator out if they mistyped the setup or scanned nothing. So: stored, encrypted,
 * inert.
 */
export async function beginTotpEnrolment(operatorUserId: string, issuer = "Revio Operator"): Promise<EnrolmentOffer> {
  const db = forSystem();
  const op = await db.operatorUser.findUnique({ where: { id: operatorUserId }, select: { email: true } });
  if (!op) throw new Error("beginTotpEnrolment: no such operator");

  const secret = generateTotpSecret();
  await db.operatorUser.update({
    where: { id: operatorUserId },
    // Re-enrolling replaces the pending secret AND clears any previous enablement, so an
    // interrupted second attempt can never leave the old app working against a new secret.
    data: { totpSecret: encryptSecret(secret), totpEnabledAt: null, totpLastStep: null },
  });

  return { secret, uri: totpUri({ secret, account: op.email, issuer }) };
}

export interface ConfirmResult {
  ok: boolean;
  /** Shown ONCE. Never retrievable afterwards — only their hashes are kept. */
  recoveryCodes?: string[];
  error?: string;
}

/**
 * Finish enrolment by proving the app works, then hand over the recovery codes.
 *
 * The proof matters: it is the difference between "2FA is on" and "2FA is on and you can actually
 * get in tomorrow". Recovery codes are issued at this moment and shown once, because the alternative
 * — a lost phone against the console that runs the business — has no other way out.
 */
export async function confirmTotpEnrolment(
  operatorUserId: string,
  code: string,
  now = Date.now(),
): Promise<ConfirmResult> {
  const db = forSystem();
  const op = await db.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!op?.totpSecret) return { ok: false, error: "Start again — there is no pending setup for this account." };
  if (op.totpEnabledAt) return { ok: false, error: "Two-factor authentication is already on for this account." };

  const secret = decryptSecret(op.totpSecret);
  if (!verifyTotp(secret, code, now)) {
    return { ok: false, error: "That code didn't match. Check your authenticator app and try the current code." };
  }

  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(normaliseRecoveryCode(c), BCRYPT_COST)));

  await db.operatorUser.update({
    where: { id: operatorUserId },
    data: { totpEnabledAt: new Date(now), totpLastStep: stepFor(now) },
  });
  // Replace rather than append: re-enrolling must invalidate the codes printed last time, or an old
  // sheet of paper keeps working against a new secret.
  await db.operatorRecoveryCode.deleteMany({ where: { operatorUserId } });
  await db.operatorRecoveryCode.createMany({
    data: hashes.map((codeHash) => ({ operatorUserId, codeHash })),
  });

  return { ok: true, recoveryCodes: codes };
}

export type SecondFactorResult =
  | { ok: true; usedRecoveryCode: boolean; recoveryCodesRemaining?: number }
  | { ok: false; error: string };

/**
 * Check the second factor at sign-in. Accepts either a TOTP code or a recovery code.
 *
 * **Replay is refused.** A TOTP code stays mathematically valid for its whole 30-second step (and
 * the neighbouring ones), so without a record of the last step accepted, a code read over a
 * shoulder or captured in a proxy works again. `totpLastStep` makes each step single-use, which is
 * what people assume a one-time password already means.
 */
export async function verifySecondFactor(
  operatorUserId: string,
  submitted: string,
  now = Date.now(),
): Promise<SecondFactorResult> {
  const db = forSystem();
  const op = await db.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true },
  });
  if (!op?.totpEnabledAt || !op.totpSecret) {
    return { ok: false, error: "Two-factor authentication is not set up for this account." };
  }

  const entered = submitted.trim();
  const secret = decryptSecret(op.totpSecret);

  if (/^\d{6}$/.test(entered.replace(/\s/g, ""))) {
    if (!verifyTotp(secret, entered, now)) {
      return { ok: false, error: "That code didn't match. Try the current one from your app." };
    }
    const step = stepFor(now);
    // The accepted window spans three steps, so compare against the last one accepted rather than
    // only the current step — otherwise the previous step's code can be reused a second time.
    if (op.totpLastStep != null && step <= op.totpLastStep) {
      return { ok: false, error: "That code has already been used. Wait for the next one." };
    }
    await db.operatorUser.update({ where: { id: operatorUserId }, data: { totpLastStep: step } });
    return { ok: true, usedRecoveryCode: false };
  }

  // Otherwise treat it as a recovery code. Every unused hash is compared so a wrong code takes the
  // same time as a right one, and so a used code is reported as used rather than as wrong.
  const normalised = normaliseRecoveryCode(entered);
  if (!normalised) return { ok: false, error: "Enter the six-digit code from your app, or a recovery code." };

  const stored = await db.operatorRecoveryCode.findMany({ where: { operatorUserId } });
  let matched: { id: string; usedAt: Date | null } | null = null;
  for (const row of stored) {
    if (await bcrypt.compare(normalised, row.codeHash)) matched = { id: row.id, usedAt: row.usedAt };
  }

  if (!matched) return { ok: false, error: "That code didn't match. Try the current one from your app." };
  if (matched.usedAt) return { ok: false, error: "That recovery code has already been used." };

  await db.operatorRecoveryCode.update({ where: { id: matched.id }, data: { usedAt: new Date(now) } });
  const remaining = await db.operatorRecoveryCode.count({ where: { operatorUserId, usedAt: null } });
  return { ok: true, usedRecoveryCode: true, recoveryCodesRemaining: remaining };
}

/** Turn 2FA off, clearing every trace so a later re-enrolment starts clean. */
export async function disableTotp(operatorUserId: string): Promise<void> {
  const db = forSystem();
  await db.operatorUser.update({
    where: { id: operatorUserId },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
  });
  await db.operatorRecoveryCode.deleteMany({ where: { operatorUserId } });
}

/** Does this account need a second factor to sign in? */
export async function requiresSecondFactor(operatorUserId: string): Promise<boolean> {
  const op = await forSystem().operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { totpEnabledAt: true },
  });
  return op?.totpEnabledAt != null;
}

function stepFor(atMs: number): number {
  return Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
}
