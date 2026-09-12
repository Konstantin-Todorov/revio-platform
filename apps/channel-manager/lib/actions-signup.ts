"use server";

import { redirect } from "next/navigation";
import { createPublicSignup } from "@revio/db";
import { signupEmail, validateSignup } from "@revio/core";
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

  /*
   * Three endings, three different screens. They used to be two, and the two hid a real failure:
   * somebody who mistyped their address, or whose first mail went to spam, was told "check your
   * email" a second time while nothing was sent — or, worse, sent to sign in for a password that
   * had never existed. They were locked out of a product they had never got into.
   */
  if (outcome.kind === "already-a-customer") {
    // No trial is started here, ever. This is the founder's gap: a hotel that trialled CRS and PMS,
    // did not buy, and comes back to this form months later must not be handed thirty more days.
    redirect(`/signup/existing?reason=${outcome.reason}`);
  }

  const url = `${productOrigin(outcome.intent)}/accept-invite/${outcome.token}`;
  const mail = signupEmail({
    name: outcome.ownerName,
    context: outcome.hotelName,
    url,
    // A second link needs to explain itself, or it reads as a duplicate we sent by mistake.
    resent: outcome.kind === "resent",
  });
  await sendEmail({ to: [outcome.email], subject: mail.subject, text: mail.text, html: mail.html });

  redirect(outcome.kind === "resent" ? "/signup/sent?again=1" : "/signup/sent");
}
