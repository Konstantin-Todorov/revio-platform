"use server";

import { revalidatePath } from "next/cache";
import { forSystem, recordHotelReply, recordSupportRequest } from "@revio/db";
import { sendEmail } from "@revio/email";
import { renderSystemEmail, renderSystemEmailText, supportKind, supportReference } from "@revio/core";
import type { GetHelpResult } from "@revio/ui/get-help";
import type { SupportReplyResult } from "@revio/ui/support-reply";
import { getSession } from "./session";

/**
 * "Get help" from RevioCRS.
 *
 * The perimeter cannot be shared — each product resolves its own session — but everything behind it
 * is: `recordSupportRequest` in `@revio/db` does the validation, the normalising and the write, so
 * the same problem reported from two products produces one kind of record and one apology.
 *
 * ⚠️ **No capability gate, deliberately.** Anybody signed in may ask for help, including roles that
 * can change nothing. A housekeeper who cannot open Settings is exactly the person most likely to be
 * standing in front of a broken screen, and a support form that refuses them loses the report.
 */
export async function submitSupportRequest(_prev: GetHelpResult, fd: FormData): Promise<GetHelpResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Your session has expired. Sign in again and send it once more." };
  }

  // Where a reply goes. Read here rather than carried in the session, which does not hold it.
  const user = await forSystem().user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  const kind = String(fd.get("kind") ?? "problem");
  const route = String(fd.get("route") ?? "") || null;
  const message = String(fd.get("message") ?? "");

  const result = await recordSupportRequest({
    tenantId: session.tenantId,
    propertyId: session.activePropertyId || null,
    userId: session.userId,
    product: "crs",
    route,
    kind,
    message,
    contactName: session.userName,
    contactEmail: user?.email ?? "",
  });
  if (!result.ok) return { ok: false, error: result.error };

  /*
   * Email us, but never let the mail provider lose the request.
   *
   * The row is already written and the operator's queue reads the row, not the inbox. A provider
   * having a bad minute must not turn a recorded incident into an error page for somebody whose
   * check-in is already broken.
   */
  const k = supportKind(kind);
  const mail = {
    preview: `${k.label} — ${session.tenantName}`,
    heading: `Support · ${result.reference}`,
    product: "RevioCRS",
    blocks: [
      {
        list: [
          `Hotel — ${session.tenantName}`,
          `Product — RevioCRS`,
          `Screen — ${route ?? "unknown"}`,
          `From — ${session.userName} (${session.role})`,
          `Reply to — ${user?.email ?? "no address on file"}`,
          `Urgency — ${k.label} · target ${k.targetHours}h`,
        ],
      },
      { p: message },
    ],
  };
  try {
    await sendEmail({
      to: [process.env.SUPPORT_INBOX?.trim() || "office@reviosoft.app"],
      subject: `[${k.key.toUpperCase()}] ${result.reference} · ${session.tenantName} · RevioCRS`,
      text: renderSystemEmailText(mail),
      html: renderSystemEmail(mail),
      ...(user?.email ? { replyTo: user.email } : {}),
    });
  } catch {
    /* the row is the record; the operator's queue reads the row */
  }

  return { ok: true, reference: result.reference };
}

/**
 * Answer us back, from inside RevioCRS.
 *
 * The half that was missing. Until now a hotel could read our reply and had no way to respond to it:
 * their only route back was a new request, which arrived as a separate case carrying none of the
 * history — so the thread both sides were supposed to share only ever had one author.
 *
 * The perimeter is here, as it is for every write: this action resolves RevioCRS's own session and
 * hands the tenant to `recordHotelReply`, which does the identical work for all three products.
 *
 * ⚠️ **No capability gate**, for the same reason `submitSupportRequest` has none: anybody signed in
 * may talk to support. The person watching a screen fail is often the person with the fewest
 * permissions.
 *
 * Sending reopens the case — see `recordHotelReply`. We email ourselves rather than relying on
 * somebody noticing the queue, and a mail failure never loses the message: the row is already
 * written and the queue reads the row.
 */
export async function replyToSupport(
  _prev: SupportReplyResult,
  fd: FormData,
): Promise<SupportReplyResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has expired. Sign in again and send it once more." };

  const requestId = String(fd.get("requestId") ?? "");
  const body = String(fd.get("body") ?? "");
  if (!requestId) return { ok: false, error: "That request could not be identified. Reload the page." };

  const result = await recordHotelReply({
    requestId,
    tenantId: session.tenantId,
    authorName: session.userName,
    body,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const reference = supportReference(requestId);
  const mail = {
    preview: `${session.tenantName} replied — ${reference}`,
    heading: `Reply on ${reference}`,
    product: "RevioCRS",
    blocks: [
      { list: [`Hotel — ${session.tenantName}`, `From — ${session.userName} (${session.role})`, `Product — RevioCRS`] },
      { p: body },
      { note: "This request is open again in the support queue." },
    ],
  };
  try {
    await sendEmail({
      to: [process.env.SUPPORT_INBOX?.trim() || "office@reviosoft.app"],
      subject: `Re: ${reference} · ${session.tenantName} · RevioCRS`,
      text: renderSystemEmailText(mail),
      html: renderSystemEmail(mail),
    });
  } catch {
    /* the row is the record; the queue reads the row, not an inbox */
  }

  revalidatePath("/help");
  return { ok: true };
}
