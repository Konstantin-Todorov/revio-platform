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
 * ## Branded since 2026-09-01, and both original constraints kept
 *
 * These were plain text on purpose: short, must survive every client, and a password-reset mail is
 * the last place to be loading remote images. Both reasons still hold and both are honoured — the
 * text part is unchanged and still sent, and the HTML part contains **no images at all** (the
 * wordmark is text in a coloured cell). Nothing to load, nothing to block, no read receipt leaked.
 *
 * What plain text cost was the thing it was protecting. An unbranded wall of text carrying a link
 * that asks for a password is indistinguishable from phishing, and staff are trained to ignore
 * exactly that. Looking like the product it came from is a security property here, not decoration.
 */

import { TOKEN_POLICY, type TokenPurpose } from "../auth/tokens.js";
import { renderSystemEmail, renderSystemEmailText, type SystemEmailBlock } from "./system-shell.js";

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
  /** The branded alternative. `sendEmail` sends it beside `text` as a multipart message. */
  html: string;
}

/** Build both parts from ONE set of blocks, so the two can never drift apart. */
function compose(subject: string, preview: string, heading: string, blocks: SystemEmailBlock[]): AuthEmail {
  // No `product`: an invitation covers every Revio product the hotel has, so naming one would
  // be wrong on the exact promise the email goes on to make.
  const args = { preview, heading, blocks };
  return { subject, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}

/**
 * The invitation. Says who invited them and to what, because an unexplained link asking for a
 * password is indistinguishable from an attack — and staff are trained, correctly, to ignore those.
 */
export function inviteEmail({ name, context, invitedBy, url }: AuthEmailArgs): AuthEmail {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const who = invitedBy ? `${invitedBy} has added you` : "You have been added";

  return compose(
    `You've been added to ${context} on Revio`,
    `Choose a password to get started with ${context}.`,
    `You've been added to ${context}`,
    [
      { p: greeting },
      { p: `${who} to ${context} on Revio.` },
      { action: { label: "Choose your password", url } },
      { note: `This link works once and expires in ${TOKEN_POLICY.invite.ttlLabel}.` },
      { p: "One login covers every Revio product your hotel uses — you will not need a separate account for each." },
      { note: "If you weren't expecting this, you can ignore this email. No account is active until the link above is used." },
    ],
  );
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

  return compose(
    "Reset your Revio password",
    "Choose a new password for your Revio account.",
    "Reset your password",
    [
      { p: greeting },
      { p: `Someone asked to reset the password for this email address on ${context}.` },
      { p: "If it was you, choose a new password here:" },
      { action: { label: "Choose a new password", url } },
      { note: `This link works once and expires in ${TOKEN_POLICY.reset.ttlLabel}.` },
      { note: "If it wasn't you, ignore this email — your password has not changed, and nobody can change it without the link above. If you keep receiving these, tell whoever runs your Revio account." },
    ],
  );
}

/** Confirmation after the fact. The one email whose entire job is to be alarming if unexpected. */
export function passwordChangedEmail({ name, context }: Omit<AuthEmailArgs, "url">): AuthEmail {
  const greeting = name ? `Hello ${name},` : "Hello,";

  return compose(
    "Your Revio password was changed",
    "Your password has just been changed.",
    "Your password was changed",
    [
      { p: greeting },
      { p: `The password for your Revio account on ${context} has just been changed.` },
      { p: "If that was you, there is nothing to do." },
      { p: "If it was not you, someone else has access to this account. Ask an owner at your hotel to reset your password immediately." },
    ],
  );
}

/** Dispatch by purpose, for callers that hold a `TokenPurpose` rather than a specific intent. */
export function authEmailFor(purpose: TokenPurpose, args: AuthEmailArgs): AuthEmail {
  return purpose === "invite" ? inviteEmail(args) : passwordResetEmail(args);
}
