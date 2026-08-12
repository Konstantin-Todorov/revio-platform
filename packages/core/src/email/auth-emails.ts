/**
 * Account emails: the invitation and the password reset.
 *
 * ## Why these are NOT in `EMAIL_TEMPLATES`
 *
 * Every other template in this package is a hotel's own voice — editable wording, their branding,
 * and for guest mail, switchable off. These two are deliberately none of that:
 *
 * - **A hotel must not be able to edit them.** Reset wording is where phishing lives. "Click here to
 *   verify your account" pasted into an editable field by whoever has Settings access is a very
 *   cheap way to harvest colleagues' passwords.
 * - **A hotel must not be able to switch them off.** Turning off the reset email locks every member
 *   of staff out of their own account permanently.
 * - **They are ours, not theirs.** The operator console sends the same two, and it has no hotel to
 *   take branding from.
 *
 * They still carry the property's *name* where there is one, because "someone invited you to Hotel
 * Sofia" is the fact that makes the mail trustworthy. What is fixed is the structure and the words
 * around the link.
 *
 * Plain text on purpose. These are short, they must survive every client, and a password-reset mail
 * is the last place to be loading remote images.
 */

import { TOKEN_POLICY, type TokenPurpose } from "../auth/tokens.js";

export interface AuthEmailArgs {
  /** The person's name if we know it — the mail still works if we do not. */
  name?: string;
  /** "Hotel Sofia", or "the Revio operator console" for our own staff. */
  context: string;
  /** Who triggered this, when a human did. Omitted for self-service resets. */
  invitedBy?: string;
  /** The full, ready-to-click URL. Built by the caller because only it knows its own origin. */
  url: string;
}

export interface AuthEmail {
  subject: string;
  text: string;
}

/**
 * The invitation. Says who invited them and to what, because an unexplained link asking for a
 * password is indistinguishable from an attack — and staff are trained, correctly, to ignore those.
 */
export function inviteEmail({ name, context, invitedBy, url }: AuthEmailArgs): AuthEmail {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const who = invitedBy ? `${invitedBy} has added you` : "You have been added";

  return {
    subject: `You've been added to ${context} on Revio`,
    text: `${greeting}

${who} to ${context} on Revio.

To get started, choose a password:

${url}

This link works once and expires in ${TOKEN_POLICY.invite.ttlLabel}.

One login covers every Revio product your hotel uses — you will not need a separate account for each.

If you weren't expecting this, you can ignore this email. No account is active until the link above
is used.

— Revio`,
  };
}

/**
 * The reset.
 *
 * Note what it does NOT say: it never confirms that an account exists. This exact text is sent for
 * an address that has never been seen, because the alternative — "no account found" — lets anyone
 * enumerate who works at a hotel by typing addresses into a form.
 */
export function passwordResetEmail({ name, context, url }: AuthEmailArgs): AuthEmail {
  const greeting = name ? `Hello ${name},` : "Hello,";

  return {
    subject: "Reset your Revio password",
    text: `${greeting}

Someone asked to reset the password for this email address on ${context}.

If it was you, choose a new password here:

${url}

This link works once and expires in ${TOKEN_POLICY.reset.ttlLabel}.

If it wasn't you, ignore this email — your password has not changed, and nobody can change it without
the link above. If you keep receiving these, tell whoever runs your Revio account.

— Revio`,
  };
}

/** Confirmation after the fact. The one email whose entire job is to be alarming if unexpected. */
export function passwordChangedEmail({ name, context }: Omit<AuthEmailArgs, "url">): AuthEmail {
  const greeting = name ? `Hello ${name},` : "Hello,";

  return {
    subject: "Your Revio password was changed",
    text: `${greeting}

The password for your Revio account on ${context} has just been changed.

If that was you, there is nothing to do.

If it was not you, someone else has access to this account. Ask an owner at your hotel to reset your
password immediately.

— Revio`,
  };
}

/** Dispatch by purpose, for callers that hold a `TokenPurpose` rather than a specific intent. */
export function authEmailFor(purpose: TokenPurpose, args: AuthEmailArgs): AuthEmail {
  return purpose === "invite" ? inviteEmail(args) : passwordResetEmail(args);
}
