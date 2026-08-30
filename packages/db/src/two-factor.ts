import bcrypt from "bcryptjs";
import {
  generateTotpSecret,
  generateRecoveryCodes,
  normaliseRecoveryCode,
  totpUri,
  verifyTotp,
  TOTP_PERIOD_SECONDS,
} from "@revio/core/server";
import { encryptSecret, decryptSecret } from "./crypto.js";

/**
 * Two-factor authentication, for any account type.
 *
 * Extracted from `operator-2fa.ts` when hotel accounts needed the same thing — the platform's rule
 * is that a thing moves behind a shared interface at the moment a second caller appears. Copying it
 * would have been quicker and would have produced two implementations of a security control, which
 * is how one of them quietly stops matching the other.
 *
 * The two account types differ only in which table they live in, so that is the only thing the
 * caller supplies: a `TwoFactorStore`. Everything security-significant — replay refusal, the hashing
 * cost, the recovery-code rules, the constant-ish comparison over every stored hash — lives here
 * once.
 *
 * ## Replay is refused
 *
 * A TOTP code stays mathematically valid for its whole 30-second step and the neighbouring ones. So
 * without a record of the last step accepted, a code read over a shoulder or captured in a proxy
 * works a second time. `lastStep` makes each step single-use, which is what people already assume a
 * one-time password means.
 *
 * ## Recovery codes are hashed
 *
 * With bcrypt, at the same cost as a password. A leaked table must not be a working set of
 * credentials — these are the thing that gets you in when the phone is gone, so they are exactly as
 * sensitive as the password and are treated that way.
 */

/** Cost 10, matching the password hashing already in use. A recovery code deserves the same. */
const BCRYPT_COST = 10;

/** What this module needs from a table, and nothing more. */
export interface TwoFactorStore {
  /** Null when the account does not exist. */
  read(id: string): Promise<{ email: string; totpSecret: string | null; totpEnabledAt: Date | null; totpLastStep: number | null } | null>;
  write(id: string, data: { totpSecret?: string | null; totpEnabledAt?: Date | null; totpLastStep?: number | null }): Promise<void>;
  listRecoveryCodes(id: string): Promise<{ id: string; codeHash: string; usedAt: Date | null }[]>;
  replaceRecoveryCodes(id: string, hashes: string[]): Promise<void>;
  markRecoveryCodeUsed(codeId: string, at: Date): Promise<void>;
  countUnusedRecoveryCodes(id: string): Promise<number>;
}

export interface EnrolmentOffer {
  /** Base32, shown for manual entry into an authenticator app. */
  secret: string;
  /** `otpauth://` for the QR code. */
  uri: string;
}

/**
 * Begin enrolment: mint a secret and hand back what the app needs to add the account.
 *
 * The secret is stored immediately but 2FA stays **off** until a code is confirmed. Storing it later
 * would mean holding it in a form field or a session across the round trip; enabling it now would
 * lock the person out if they mistyped the setup or scanned nothing. So: stored, encrypted, inert.
 */
export async function beginEnrolment(
  store: TwoFactorStore,
  id: string,
  issuer: string,
): Promise<EnrolmentOffer> {
  const account = await store.read(id);
  if (!account) throw new Error("beginEnrolment: no such account");

  const secret = generateTotpSecret();
  // Re-enrolling replaces the pending secret AND clears any previous enablement, so an interrupted
  // second attempt can never leave the old app working against a new secret.
  await store.write(id, { totpSecret: encryptSecret(secret), totpEnabledAt: null, totpLastStep: null });

  return { secret, uri: totpUri({ secret, account: account.email, issuer }) };
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
 * — a lost phone against the account that runs a hotel's rates — has no other way out.
 */
export async function confirmEnrolment(
  store: TwoFactorStore,
  id: string,
  code: string,
  now = Date.now(),
): Promise<ConfirmResult> {
  const account = await store.read(id);
  if (!account?.totpSecret) {
    return { ok: false, error: "Start again — there is no pending setup for this account." };
  }
  if (account.totpEnabledAt) {
    return { ok: false, error: "Two-factor authentication is already on for this account." };
  }

  const secret = decryptSecret(account.totpSecret);
  if (!verifyTotp(secret, code, now)) {
    return { ok: false, error: "That code didn't match. Check your authenticator app and try the current code." };
  }

  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(normaliseRecoveryCode(c), BCRYPT_COST)));

  await store.write(id, { totpEnabledAt: new Date(now), totpLastStep: stepFor(now) });
  // Replace rather than append: re-enrolling must invalidate the codes printed last time, or an old
  // sheet of paper keeps working against a new secret.
  await store.replaceRecoveryCodes(id, hashes);

  return { ok: true, recoveryCodes: codes };
}

export type SecondFactorResult =
  | { ok: true; usedRecoveryCode: boolean; recoveryCodesRemaining?: number }
  | { ok: false; error: string };

/**
 * Check the second factor at sign-in. Accepts either a TOTP code or a recovery code.
 */
export async function verifySecond(
  store: TwoFactorStore,
  id: string,
  submitted: string,
  now = Date.now(),
): Promise<SecondFactorResult> {
  const account = await store.read(id);
  if (!account?.totpEnabledAt || !account.totpSecret) {
    return { ok: false, error: "Two-factor authentication is not set up for this account." };
  }

  const entered = submitted.trim();
  const secret = decryptSecret(account.totpSecret);

  if (/^\d{6}$/.test(entered.replace(/\s/g, ""))) {
    if (!verifyTotp(secret, entered, now)) {
      return { ok: false, error: "That code didn't match. Try the current one from your app." };
    }
    const step = stepFor(now);
    // The accepted window spans three steps, so compare against the last step ACCEPTED rather than
    // only the current one — otherwise the previous step's code can be reused a second time.
    if (account.totpLastStep != null && step <= account.totpLastStep) {
      return { ok: false, error: "That code has already been used. Wait for the next one." };
    }
    await store.write(id, { totpLastStep: step });
    return { ok: true, usedRecoveryCode: false };
  }

  // Otherwise treat it as a recovery code. Every stored hash is compared so a wrong code takes the
  // same time as a right one, and so a used code is reported as used rather than as wrong.
  const normalised = normaliseRecoveryCode(entered);
  if (!normalised) return { ok: false, error: "Enter the six-digit code from your app, or a recovery code." };

  const stored = await store.listRecoveryCodes(id);
  let matched: { id: string; usedAt: Date | null } | null = null;
  for (const row of stored) {
    if (await bcrypt.compare(normalised, row.codeHash)) matched = { id: row.id, usedAt: row.usedAt };
  }

  if (!matched) return { ok: false, error: "That code didn't match. Try the current one from your app." };
  if (matched.usedAt) return { ok: false, error: "That recovery code has already been used." };

  await store.markRecoveryCodeUsed(matched.id, new Date(now));
  const remaining = await store.countUnusedRecoveryCodes(id);
  return { ok: true, usedRecoveryCode: true, recoveryCodesRemaining: remaining };
}

/** Turn 2FA off, clearing every trace so a later re-enrolment starts clean. */
export async function disable(store: TwoFactorStore, id: string): Promise<void> {
  await store.write(id, { totpSecret: null, totpEnabledAt: null, totpLastStep: null });
  await store.replaceRecoveryCodes(id, []);
}

/** Does this account need a second factor to sign in? */
export async function isEnabled(store: TwoFactorStore, id: string): Promise<boolean> {
  return (await store.read(id))?.totpEnabledAt != null;
}

function stepFor(atMs: number): number {
  return Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
}
