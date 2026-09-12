/**
 * Who is actually behind an address, and what the signup form should do about it.
 *
 * ## Why "is this address already ours" is not the same question as "is this string equal"
 *
 * `maria+trial2@gmail.com`, `maria+trial3@gmail.com` and `m.a.r.i.a@gmail.com` all arrive in the
 * same inbox as `maria@gmail.com`. Compared as strings they are four different people, and four
 * different people each get thirty free days of all three products. Plus-addressing is the single
 * most common way a trial is taken twice, and it needs no skill at all.
 *
 * So uniqueness is checked against a NORMALISED key while mail is always sent to the address the
 * person actually typed. Both are kept: the key is for deciding, the original is for writing to.
 */

/** Providers that deliver `a.b@` and `ab@` to the same mailbox. Gmail is the one that matters. */
const DOT_INSENSITIVE = new Set(["gmail.com", "googlemail.com"]);

/**
 * Throwaway mailbox providers.
 *
 * Deliberately short and hand-picked rather than a downloaded list of thousands: a long list goes
 * stale, and every entry is a chance to refuse a real hotel using a domain we guessed wrong about.
 * These are services whose entire purpose is a mailbox that dies in ten minutes — a hotel has never
 * used one to run its business.
 */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org",
  "throwawaymail.com", "yopmail.com", "getnada.com", "trashmail.com", "sharklasers.com",
  "maildrop.cc", "fakeinbox.com", "dispostable.com", "mintemail.com", "emailondeck.com",
]);

/**
 * The key an address is recognised by.
 *
 * ⚠️ For **recognition only**. It is never what we send to and never what anybody signs in with —
 * normalising the address people actually use would lock somebody out of their own account the day
 * their provider started caring about dots.
 */
export function emailIdentityKey(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  // Sub-addressing: everything from the first `+` is a label the sender chose, not part of the box.
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);

  if (DOT_INSENSITIVE.has(domain)) local = local.replace(/\./g, "");

  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  return at >= 0 && DISPOSABLE.has(email.slice(at + 1).trim().toLowerCase());
}

/**
 * What the form does next.
 *
 * ⚠️ **This deliberately tells somebody that an address is already registered**, which the sign-in
 * and password-reset screens never do. That is a considered difference rather than an oversight:
 *
 * - On **sign-in and reset**, a distinguishing answer hands an attacker a list of our customers for
 *   free, and there is no usability cost to being vague, because the person already has an account
 *   and knows it.
 * - On **signup**, being vague has a real cost and buys much less. A hotelier who already has an
 *   account and is told "check your email" waits for a message that never usefully arrives, and
 *   concludes the product is broken before they have seen it. OWASP names registration as the one
 *   place this trade genuinely runs both ways, and an open registration form has to say *something*
 *   eventually.
 *
 * The leak is narrowed rather than accepted whole: the answer is only given AFTER a complete form
 * is submitted (never as you type), and the platform-wide signup ceiling limits how fast a list
 * could be walked.
 *
 * Decided by the founder on 2026-09-12, after the alternative was put and its cost stated.
 */
export type SignupVerdict =
  /** Nobody has this mailbox. Create the tenant and send the confirmation. */
  | { kind: "create" }
  /** They started a signup and never opened the link. Send it again — do NOT create a second one. */
  | { kind: "resend-confirmation" }
  /** A finished account. Send them to sign in; never to a second trial. */
  | { kind: "already-a-customer"; reason: "active" | "suspended" }
  /** Refused before anything is created. */
  | { kind: "refused"; message: string };

export interface ExistingAccount {
  /** Whether a password has ever been set — the difference between a real account and an abandoned signup. */
  hasPassword: boolean;
  tenantStatus: string;
}

export function signupVerdict(args: {
  email: string;
  /** The account found by identity key, if any. */
  existing: ExistingAccount | null;
}): SignupVerdict {
  if (isDisposableEmail(args.email)) {
    return {
      kind: "refused",
      message:
        "That looks like a temporary email address. Use the one you actually run the hotel from — " +
        "it is where your bookings and your invoices will go.",
    };
  }

  if (!args.existing) return { kind: "create" };

  /*
   * ⚠️ An unfinished signup is NOT a customer, and must not be treated as one.
   *
   * Without this branch, somebody who mistypes their address, or whose confirmation lands in spam,
   * tries again and is told they already have an account — and is then sent to a sign-in screen
   * for a password that has never existed. They are locked out of a product they never got into,
   * by us, for doing nothing wrong. Resending is the only correct answer.
   */
  if (!args.existing.hasPassword) return { kind: "resend-confirmation" };

  return {
    kind: "already-a-customer",
    reason: args.existing.tenantStatus === "suspended" ? "suspended" : "active",
  };
}
