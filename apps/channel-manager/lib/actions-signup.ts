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
 * ⚠️ **Three different endings, and one of them names an existing account.** This comment used to
 * say the outcomes were indistinguishable; that described the design before the founder changed it
 * on 13 September, and the code had already moved on. A stale comment claiming a security property
 * the code does not have is worse than no comment — somebody reasons from a guarantee that is not
 * there. Caught by Codex reviewing the live site against the source.
 *
 * `signupVerdict` in `@revio/core` carries the reasoning: registration is the one surface where
 * vagueness costs the user more than it costs an attacker, and the leak is narrowed by answering
 * only after a complete submit and under the platform's hourly ceiling. Sign-in and password reset
 * stay non-enumerable, and that distinction is the whole point.
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
  /*
   * ⚠️ The send is CHECKED, not fired and forgotten.
   *
   * `sendEmail` returns `{ ok: false, error }` rather than throwing — it never throws, by design,
   * so that a mail outage cannot turn a completed booking into an error page elsewhere in the
   * platform. Here that same behaviour is a trap: ignoring the result sends somebody to a screen
   * reading "Check your email" for a message that was never accepted, with nothing anywhere saying
   * so. That is the exact defect class this codebase keeps finding — something reporting a success
   * it did not achieve.
   *
   * The tenant is deliberately NOT unwound, for the same reason the operator invite does not: the
   * account is made and correct, and only the mail failed. Trying again reaches the "resent" branch
   * above, which issues a fresh link for the SAME account — so the recovery path already exists and
   * this just has to point at it honestly.
   */
  const sent = await sendEmail({ to: [outcome.email], subject: mail.subject, text: mail.text, html: mail.html });
  if (!sent.ok) {
    console.error(`[signup] confirmation email failed for ${outcome.hotelName}: ${sent.error ?? "unknown"}`);
    return {
      error:
        "Your account is created, but we could not send the confirmation email just now. " +
        "Press the button again in a moment — we will send a fresh link to the same address.",
    };
  }

  redirect(outcome.kind === "resent" ? "/signup/sent?again=1" : "/signup/sent");
}
