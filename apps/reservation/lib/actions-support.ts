"use server";

import { forSystem, recordSupportRequest } from "@revio/db";
import { sendEmail } from "@revio/email";
import { renderSystemEmail, renderSystemEmailText, supportKind } from "@revio/core";
import type { GetHelpResult } from "@revio/ui/get-help";
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
