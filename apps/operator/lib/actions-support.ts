"use server";

import { revalidatePath } from "next/cache";
import { addSupportMessage, forSystem, recordSupportRequest } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
import { sendEmail } from "@revio/email";
import { renderSystemEmail, renderSystemEmailText, supportReference } from "@revio/core";
import { getOperatorSession } from "./session";

/**
 * Mark a support request as answered.
 *
 * `handledAt` + `handledById`, the same convention `Lead` uses: null is the working queue, and a
 * timestamp is somebody taking responsibility rather than a row disappearing.
 *
 * Deliberately not a delete and not a status enum. The request stays visible under "Answered"
 * because a renewal call asks what a client has reported before, and a queue that empties itself
 * cannot answer that.
 */
export async function markSupportHandled(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to update the support queue.");

  const id = String(fd.get("id") ?? "");
  if (!id) return flashError("Nothing was selected. Reload the page and try again.");

  // updateMany, so re-marking one that somebody else just handled is a no-op rather than an error.
  const { count } = await forSystem().supportRequest.updateMany({
    where: { id, handledAt: null },
    data: { handledAt: new Date(), handledById: session.userId },
  });

  // The case has its own page as well as the queue, and a stale one there is the same lie.
  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
  return setFlash(count > 0 ? "success" : "info", count > 0 ? "Marked as answered." : "Somebody had already answered that one.");
}

/**
 * Log a question that arrived some other way — a call, an email, a conversation.
 *
 * The founder's concern, and it is the right one: the queue only recorded what came through the
 * in-app form, so it only ever knew about the half of a hotel that types. Somebody who telephones
 * asks the same questions, often the more urgent ones because they picked up the phone, and those
 * left no trace. Writing help from that queue would have meant writing it for the wrong audience.
 *
 * A logged call joins the same queue, gets the same reference and the same lateness clock, and
 * counts as the same evidence for what the help should say next.
 *
 * No email is sent: the hotel already has us on the phone. This is a record, not a notification.
 */
export async function logSupportRequest(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to log a request.");

  const tenantId = String(fd.get("tenantId") ?? "");
  if (!tenantId) return flashError("Choose which client this was.");

  const tenant = await forSystem().tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      properties: { orderBy: { name: "asc" }, take: 1, select: { id: true } },
      users: { where: { role: "owner", active: true }, take: 1, select: { name: true, email: true } },
    },
  });
  if (!tenant) return flashError("That client no longer exists.");

  const owner = tenant.users[0];
  const result = await recordSupportRequest({
    tenantId,
    propertyId: tenant.properties[0]?.id ?? null,
    // Nobody's account: this was logged by us on their behalf, and pretending otherwise would put a
    // staff member's name on words they did not type.
    userId: null,
    product: String(fd.get("product") ?? "crs"),
    route: null,
    kind: String(fd.get("kind") ?? "problem"),
    message: String(fd.get("message") ?? ""),
    contactName: String(fd.get("contactName") ?? "").trim() || owner?.name || tenant.name,
    contactEmail: String(fd.get("contactEmail") ?? "").trim() || owner?.email || "",
    source: String(fd.get("source") ?? "phone"),
  });
  if (!result.ok) return flashError(result.error);

  revalidatePath("/support");
  return setFlash("success", `Logged as ${result.reference}.`);
}

/**
 * Answer a hotel, from here.
 *
 * ## The system is the record; email is the delivery
 *
 * Both, always. Nobody logs into a portal to check whether support replied, so a reply that lives
 * only in the console would be missed and the hotel would conclude they were ignored — worse than
 * the inbox we are replacing. And an emailed reply that lives only in a sent folder is how "what did
 * we tell them last time" became unanswerable in the first place.
 *
 * `emailedAt` is null when the send failed. That is deliberately visible in the thread: a reply the
 * hotel never received is indistinguishable from being ignored, and the person who wrote it is the
 * only one who can notice and pick up the phone.
 *
 * Replying marks the request answered. It is the act that answers it, and asking somebody to reply
 * and then also tick a box is how queues end up lying about what is outstanding.
 */
export async function replyToSupportRequest(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to reply.");

  const id = String(fd.get("id") ?? "");
  const body = String(fd.get("body") ?? "");
  if (!id) return flashError("Nothing was selected. Reload the page and try again.");

  const db = forSystem();
  const request = await db.supportRequest.findUnique({
    where: { id },
    select: { id: true, contactEmail: true, contactName: true, kind: true, message: true, product: true },
  });
  if (!request) return flashError("That request no longer exists.");

  /*
   * Send FIRST, then record with the result.
   *
   * The other order would have to write the row and then update it, and a failure between the two
   * leaves a message claiming it was delivered when it was not. Recording once, with the answer
   * already known, cannot produce that.
   */
  let emailedAt: Date | null = null;
  if (request.contactEmail) {
    const reference = supportReference(request.id);
    const mail = {
      preview: body.slice(0, 120),
      heading: `Re: ${reference}`,
      blocks: [
        { p: body },
        { note: `You asked: “${request.message.slice(0, 300)}”` },
        { note: "Reply to this email and it reaches us — or open Get help in your Revio account." },
      ],
    };
    try {
      const res = await sendEmail({
        to: [request.contactEmail],
        subject: `Re: ${reference} · Revio support`,
        text: renderSystemEmailText(mail),
        html: renderSystemEmail(mail),
      });
      if (res.ok) emailedAt = new Date();
    } catch {
      /* recorded as undelivered below, which is the honest state */
    }
  }

  const added = await addSupportMessage({
    requestId: id,
    side: "revio",
    authorName: session.name,
    body,
    emailedAt,
  });
  if (!added.ok) return flashError(added.error);

  // Replying IS answering it.
  await db.supportRequest.updateMany({
    where: { id, handledAt: null },
    data: { handledAt: new Date(), handledById: session.userId },
  });

  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
  return setFlash(
    emailedAt ? "success" : "error",
    emailedAt
      ? "Replied, and the email is on its way."
      : "Saved to the thread, but the email did not go out — tell them another way.",
  );
}
