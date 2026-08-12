/**
 * Whether a signed-in session is still allowed to exist.
 *
 * Sessions are stateless JWTs: the signature proves we issued the token, and nothing else. That is
 * fine for "is this really Elena" and useless for "should Elena still be signed in", which is a
 * question only the database can answer and which changes *after* the token was minted.
 *
 * Rather than a session table, each account carries **`sessionsValidFrom`** — a line in time before
 * which its tokens are dead. The JWT's own `iat` is compared against it on every request. That gives
 * revocation with no extra storage, no per-request write, and no session rows to expire, because the
 * account row is already being read to check `active`.
 *
 * ## What moves the line
 *
 * - **A password change or reset.** This is the one that matters. N2 shipped password reset; without
 *   this, resetting a *stolen* password locks nobody out — the thief's token stays valid for the rest
 *   of its seven days, which makes the reset feel like a fix while changing nothing.
 * - **"Sign out everywhere"**, for a laptop left on a train.
 * - Never anything routine. Moving it signs the person out of every device including the one they are
 *   holding, so it belongs to deliberate acts only.
 *
 * ## Why seconds, and why `>=` is wrong here
 *
 * A JWT `iat` is whole seconds; `sessionsValidFrom` is a millisecond timestamp. A token minted in the
 * same second as the cutoff would compare as older than it once the fractional part is dropped — so
 * the *current* session would be killed by its own password change. Comparing at second granularity
 * and treating "same second" as valid is what keeps someone signed in on the device they just used to
 * change their password.
 */

/** Seconds since the epoch, as a JWT `iat` carries it. */
export type IssuedAtSeconds = number;

export interface SessionValidityInput {
  /** The `iat` claim of the presented token. */
  issuedAt: IssuedAtSeconds | undefined;
  /** The account's cutoff, or null/undefined when it has never been revoked. */
  sessionsValidFrom: Date | null | undefined;
  /** False for a deactivated account — checked here so every caller asks the same question. */
  active: boolean;
}

export type SessionVerdict =
  | { ok: true }
  | { ok: false; reason: "deactivated" | "revoked" | "no-issued-at" };

/**
 * The whole decision, in one place, so four apps cannot each implement three quarters of it.
 *
 * Fails CLOSED on a token with no `iat`. Every token we mint has one; a token without it is either
 * from a different issuer or hand-made, and neither should be trusted for want of a timestamp.
 */
export function checkSessionValidity(input: SessionValidityInput): SessionVerdict {
  if (!input.active) return { ok: false, reason: "deactivated" };
  if (!input.sessionsValidFrom) return { ok: true };
  if (typeof input.issuedAt !== "number" || !Number.isFinite(input.issuedAt)) {
    return { ok: false, reason: "no-issued-at" };
  }

  const cutoff = Math.floor(input.sessionsValidFrom.getTime() / 1000);
  // Same second counts as valid — see the note above about a password change signing you out of the
  // browser you changed it in.
  return input.issuedAt >= cutoff ? { ok: true } : { ok: false, reason: "revoked" };
}

/**
 * How long a new session lasts.
 *
 * "Remember me" is a real choice, not a longer default: a shared reception terminal and a manager's
 * own laptop want opposite answers, and picking one for both is how a hotel ends up with a permanently
 * signed-in machine at the front desk where guests stand.
 */
export const SESSION_TTL_SECONDS = {
  /** Closing the browser should end it — the front-desk default. */
  short: 60 * 60 * 12,
  /** A fortnight, for a device one person owns. */
  remembered: 60 * 60 * 24 * 14,
} as const;

export function sessionTtlSeconds(remember: boolean): number {
  return remember ? SESSION_TTL_SECONDS.remembered : SESSION_TTL_SECONDS.short;
}
