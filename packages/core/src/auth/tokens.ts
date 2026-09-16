/**
 * Invite and password-reset tokens — the rules, pure and testable.
 *
 * These replace the arrangement where every account created anywhere on the platform was given the
 * same hardcoded password and had no way to change it. That was not a copy problem, it was this
 * feature being missing (see `docs/COPY.md`).
 *
 * Generation, hashing and storage live in `@revio/db` (`auth-tokens.ts`). What is here is the part
 * that is a judgement rather than a mechanism: how long a link lives, what makes it unusable, and
 * what counts as an acceptable password.
 */

/**
 * ⚠️ A hand-off purpose names its TARGET PRODUCT, and that is the product binding.
 *
 * A central login authenticates once and then opens whichever product the hotel asks for. The
 * credential that carries them across must be bound to the account *and* to the destination —
 * otherwise a token minted to open RevioCRS also opens RevioPMS, and one click on a shared screen
 * becomes a session in a product the person never chose.
 *
 * Encoding the destination in the purpose gets that binding from machinery that already exists and
 * is already tested: `resolveToken` treats a purpose mismatch as **unrecognised** — it does not say
 * "wrong product", because that would confirm the token exists. A RevioCRS hand-off presented to
 * RevioPMS is therefore simply not a token, which is the correct answer and needed no new code.
 *
 * The alternative was a `product` column on `AuthToken` — a migration against production to store
 * something the purpose can already express.
 */
export type HandoffPurpose = "handoff:cm" | "handoff:crs" | "handoff:pms";
export type TokenPurpose = "invite" | "reset" | HandoffPurpose;

/** The hand-off purpose for a product key, so no caller builds the string by hand. */
export function handoffPurposeFor(product: "cm" | "crs" | "pms"): HandoffPurpose {
  return `handoff:${product}`;
}

/** Is this purpose a hand-off? Used where the three share one behaviour. */
export function isHandoff(purpose: TokenPurpose): purpose is HandoffPurpose {
  return purpose.startsWith("handoff:");
}

export interface TokenPolicy {
  ttlMs: number;
  /** Shown in the email, so the person knows how long they have. */
  ttlLabel: string;
}

/**
 * Invites live for a week; resets for an hour.
 *
 * The asymmetry is deliberate. An invite is expected — someone told a colleague to look out for it,
 * and it may sit unread over a weekend. A reset link is a live credential for whoever holds it, and
 * the most common way one leaks is a mailbox that stays open on a shared reception computer long
 * after the person who asked for it has gone home.
 */
export const TOKEN_POLICY: Record<TokenPurpose, TokenPolicy> = {
  invite: { ttlMs: 7 * 24 * 60 * 60_000, ttlLabel: "7 days" },
  reset: { ttlMs: 60 * 60_000, ttlLabel: "1 hour" },
  /*
   * ⚠️ Thirty SECONDS, and the unit is the point.
   *
   * A hand-off is not a link anybody keeps — it is minted the instant a button is pressed and spent
   * by the redirect that follows, so its whole life is one round trip. It still ends up in browser
   * history and in whatever logs sit in front of the app, which is exactly why it must be dead
   * before anyone could read it there. Single use is the primary control; this is the second.
   *
   * The design note for central login states it as a requirement: "no credential in a URL outlives
   * its use — single-use, seconds not minutes, and never logged".
   */
  "handoff:cm": { ttlMs: 30_000, ttlLabel: "30 seconds" },
  "handoff:crs": { ttlMs: 30_000, ttlLabel: "30 seconds" },
  "handoff:pms": { ttlMs: 30_000, ttlLabel: "30 seconds" },
};

/** The stored shape of a token, minus the secret itself — which is never stored, only its hash. */
export interface TokenRecord {
  purpose: TokenPurpose;
  expiresAt: number;
  usedAt: number | null;
}

export type TokenCheck =
  | { usable: true }
  | { usable: false; reason: "expired" | "used"; message: string };

/**
 * Is this token still good?
 *
 * `used` and `expired` are reported separately because they need different words on screen — one
 * means "ask for another", the other means "you or someone already did this". They are deliberately
 * NOT collapsed into a single vague failure: a person who clicks their reset link twice deserves to
 * be told that is what happened rather than to suspect they are being attacked.
 */
export function checkToken(record: TokenRecord, now: number): TokenCheck {
  if (record.usedAt !== null) {
    return {
      usable: false,
      reason: "used",
      message:
        isHandoff(record.purpose)
          /* Reassuring on purpose: this is the normal result of a reload or a back button, not a
             fault. The person is already signed in; they need the door, not an explanation. */
          ? "That link has already been used. Open the product again from your account."
          : record.purpose === "invite"
            ? "This invitation has already been used. Try signing in, or ask for a new one."
            : "This link has already been used. Request a new one if you still need to change your password.",
    };
  }
  if (record.expiresAt <= now) {
    return {
      usable: false,
      reason: "expired",
      message:
        isHandoff(record.purpose)
          ? "That link timed out. Open the product again from your account — it takes a second."
          : record.purpose === "invite"
            ? "This invitation has expired. Ask an owner at your hotel to send another."
            : "This link has expired. Password reset links are valid for 1 hour — request a new one.",
    };
  }
  return { usable: true };
}

/** Password rules. Local checks here; the breach check is `isBreachedPassword` in core/server. */
export const PASSWORD_MIN_LENGTH = 10;

export type PasswordCheck = { ok: true } | { ok: false; message: string };

/**
 * Accept or reject a password the user chose.
 *
 * Length is the only hard rule. Composition requirements (a digit, a symbol, a capital) reliably
 * produce `Password1!` and are not asked for — NIST dropped them for the same reason. A longer
 * minimum buys far more than a wider alphabet.
 */
function isSequential(value: string): boolean {
  const clean = value.replace(/[^a-z0-9]/g, "");
  if (clean.length < 6) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < clean.length; i++) {
    const delta = clean.charCodeAt(i) - clean.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
}

export function validatePassword(password: string, context: { email?: string } = {}): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > 200) {
    return { ok: false, message: "That password is too long — 200 characters maximum." };
  }

  const lower = password.toLowerCase();

  // The handful that would otherwise sail past a length check on this platform specifically.
  const OBVIOUS = ["revio1234", "password", "12345678", "qwertyuiop", "letmein123"];
  if (OBVIOUS.some((bad) => lower === bad || lower.startsWith(bad))) {
    return { ok: false, message: "That password is too easy to guess. Choose something else." };
  }

  /*
   * Length alone lets through the three shapes people reach for when told "at least ten characters"
   * (N5). None of these is caught by a length rule, and all three are near the top of every cracking
   * dictionary — so the minimum would be doing almost nothing for the people most likely to hit it.
   */

  // One character repeated: "aaaaaaaaaa", "1111111111".
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, message: "That's the same character repeated. Choose something else." };
  }

  // A run along the alphabet or the number row, forwards or backwards.
  if (isSequential(lower)) {
    return { ok: false, message: "That's a simple sequence. Choose something less predictable." };
  }

  // A walk across the keyboard: "qwertyuiop", "asdfghjkl", "1qaz2wsx".
  const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
  const stripped = lower.replace(/[^a-z0-9]/g, "");
  if (
    stripped.length >= 6 &&
    ROWS.some((row) => row.includes(stripped) || [...row].reverse().join("").includes(stripped))
  ) {
    return { ok: false, message: "That's a row of keys. Choose something less predictable." };
  }

  // The property or product name with numbers after it — the exact thing a hotel picks under
  // pressure, and the first thing anyone targeting THIS platform would try.
  if (/^(revio|hotel|reception|frontdesk|welcome|admin)\d*$/.test(stripped)) {
    return { ok: false, message: "That password is too easy to guess. Choose something else." };
  }

  // A password containing the account's own email local part is a password an attacker starts with.
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) {
    return { ok: false, message: "Don't use your email address in your password." };
  }

  return { ok: true };
}
