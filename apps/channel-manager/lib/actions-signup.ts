"use server";

import { redirect } from "next/navigation";
import { createPublicSignup } from "@revio/db";
import { passwordResetEmail, signupEmail, validateSignup } from "@revio/core";
import { sendEmail } from "@revio/email";
import { productOrigin } from "@revio/ui/product-links";

export interface SignupResult { ok?: boolean; error?: string }

/**
 * A hotel signing itself up.
 *
 * ⚠️ **No capability gate, and deliberately so** — this is the one action in RevioLink whose whole
 * purpose is to be used by somebody with no account. Listed in `scripts/authz-lint.mjs` EXEMPT with
 * that reason. Its protections are different in kind: a platform-wide hourly ceiling on tenant
 * creation, and an answer that cannot be used to discover who our customers are.
 *
 * ⚠️ **Both outcomes look identical to the person filling in the form.** A new address and an
 * address that already has an account produce the same screen and the same words. Saying "that
 * email is already registered" would turn this page into a tool for finding out which hoteliers use
 * Revio, one guess at a time — the same refusal the booking engine made for guest recognition (K6).
 * The person who really owns the address gets a mail, so a genuine forgotten-account is still
 * resolved; it is resolved in their inbox rather than on a stranger's screen.
 */
export async function submitSignup(_prev: SignupResult | null, fd: FormData): Promise<SignupResult> {
  // The SAME validator the writer runs — see the note in `createPublicSignup`. Checked here too so
  // a typo comes back instantly instead of after a round trip that creates nothing.
  const valid = validateSignup({
    hotelName: String(fd.get("hotelName") ?? ""),
    ownerName: String(fd.get("ownerName") ?? ""),
    email: String(fd.get("email") ?? ""),
    intent: String(fd.get("intent") ?? ""),
  });
  if (!valid.ok) return { error: valid.message };

  const outcome = await createPublicSignup(valid.fields);
  if (!outcome.ok) return { error: outcome.message };

  if (outcome.kind === "created") {
    // The link opens the product they named. It is only the door — the trial covers all three.
    const url = `${productOrigin(outcome.intent)}/accept-invite/${outcome.token}`;
    const mail = signupEmail({ name: outcome.ownerName, context: outcome.hotelName, url });
    await sendEmail({ to: [outcome.email], subject: mail.subject, text: mail.text, html: mail.html });
  } else {
    /*
     * Somebody tried to sign up with an address that already has an account.
     *
     * They get a password-reset mail rather than silence, because the overwhelmingly likely person
     * on the other end is the owner themselves, having forgotten they already have one. Silence
     * would leave them staring at "check your email" with nothing arriving.
     *
     * It is a RESET link, not a second invitation: it cannot create anything and it cannot be used
     * to take over an account somebody else owns — the mail goes only to the address that already
     * holds it.
     */
    const url = `${productOrigin("cm")}/forgot-password`;
    const mail = passwordResetEmail({ context: "Revio", url });
    await sendEmail({ to: [outcome.email], subject: mail.subject, text: mail.text, html: mail.html });
  }

  redirect("/signup/sent");
}
