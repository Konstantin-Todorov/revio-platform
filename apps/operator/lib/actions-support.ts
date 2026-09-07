"use server";

import { revalidatePath } from "next/cache";
import { forSystem, recordSupportRequest } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
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

  revalidatePath("/support");
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
