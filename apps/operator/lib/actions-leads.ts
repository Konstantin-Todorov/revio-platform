"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { sendEmail } from "@revio/email";
import { renderSystemEmail, renderSystemEmailText } from "@revio/core";
import { setFlash, flashError } from "@revio/ui/flash";
import { originFor } from "./product-origins";
import { getOperatorSession } from "./session";

/**
 * Mark a demo request as dealt with — the only state a lead has.
 *
 * Deliberately a toggle and not a status pipeline. A lead is either still owed a reply or it is not;
 * inventing "contacted / qualified / nurturing" here would be a CRM nobody asked for, and the
 * relationship record for anyone who becomes a customer already exists as `ClientAccount`.
 */
export async function setLeadHandled(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return;

  const id = String(fd.get("id") ?? "");
  const handled = String(fd.get("handled") ?? "") === "1";
  if (!id) return;

  await forSystem().lead.update({
    where: { id },
    data: handled
      ? { handledAt: new Date(), handledById: session.userId }
      : { handledAt: null, handledById: null },
  });

  revalidatePath("/leads");
}

/**
 * Email an enquiry a link to start the free trial themselves.
 *
 * ## Why a LINK and not an account
 *
 * The obvious version of this button creates the tenant here and emails a password. Three reasons
 * it does not:
 *
 * 1. **Nobody at Revio should ever know a customer's password** (phase N2). A link through the
 *    ordinary public signup means they choose it and we never see it.
 * 2. **There must be one signup path.** Every abuse rule already lives there — one trial per
 *    product ever, aliases of a mailbox recognised as the same mailbox, the platform-wide hourly
 *    ceiling. A second door built here would have to re-implement all of it, and the copy that
 *    drifts is always the permissive one.
 * 3. It is the same page the website sends people to, so what they see matches what we said.
 *
 * So this sends the link, records that we sent it, and marks the lead handled. If that address has
 * already had its trial, the signup page — not this action — is what says so, which is the only
 * place that answer stays correct.
 */
export async function sendLeadTrialInvite(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return;

  const id = String(fd.get("id") ?? "");
  if (!id) return flashError("That enquiry was not identified — reload the page and try again.");

  const lead = await forSystem().lead.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, company: true, trialSentAt: true },
  });
  if (!lead) return flashError("That enquiry no longer exists.");
  if (!lead.email) {
    return flashError(`${lead.name} left no email address, so there is nowhere to send a trial link.`);
  }
  /*
   * Idempotent, and it SAYS so. Two people working the queue, or one person clicking twice on a
   * slow connection, send one email — and the second click gets told why nothing happened rather
   * than a button that appears to do nothing.
   */
  if (lead.trialSentAt) {
    return flashError(
      `A trial link already went to ${lead.email} on ${lead.trialSentAt.toISOString().slice(0, 10)}. Reply to them directly instead of sending a second one.`,
    );
  }

  const first = lead.name.trim().split(/\s+/)[0] || "there";
  // Prefilled so the link is one less thing to type, and so the address we invited is the address
  // that gets the trial. They can still change it; the signup verifies whatever they submit.
  const url = `${originFor("cm")}/signup?email=${encodeURIComponent(lead.email)}`;

  const mail = {
    preview: "Your 30-day trial of Revio — all three products, no card.",
    heading: `${first}, here is your free trial`,
    product: "Revio",
    blocks: [
      { p: `Thanks for getting in touch${lead.company ? ` about ${lead.company}` : ""}. You can start straight away — the link below sets up your account.` },
      { p: "One trial covers all three products for 30 days: RevioLink for your channels, RevioCRS for reservations and rates, and RevioPMS for the front desk. No card is asked for." },
      { action: { label: "Start my free trial", url } },
      {
        note: "If you decide to keep it afterwards, you pay from the day you decide — never for a day of the trial. If you do nothing it simply switches off, and nothing is deleted.",
      },
    ],
  };

  /*
   * ⚠️ The send is checked, and the record only happens if it worked.
   *
   * Writing `trialSentAt` before knowing the mail went out produces the worst state this queue can
   * hold: a lead that reads "trial sent" to everyone who looks at it, sitting next to a person who
   * received nothing and is waiting. Better to leave it unsent and let somebody click again.
   */
  const sent = await sendEmail({
    to: [lead.email],
    subject: "Your 30-day Revio trial",
    text: renderSystemEmailText(mail),
    html: renderSystemEmail(mail),
  });
  if (!sent.ok) {
    return flashError(`Could not email ${lead.email} — nothing was recorded, so you can try again.`);
  }

  await forSystem().lead.update({
    where: { id },
    data: {
      trialSentAt: new Date(),
      trialSentById: session.userId,
      // Sending the trial IS dealing with it — leaving it in the queue afterwards would have
      // somebody write a second, worse version of the same email.
      handledAt: new Date(),
      handledById: session.userId,
    },
  });

  revalidatePath("/leads");
  return setFlash("success", `Trial link sent to ${lead.email}.`);
}
