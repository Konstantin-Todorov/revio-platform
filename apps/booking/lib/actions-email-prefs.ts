"use server";

import { redirect } from "next/navigation";
import { guestByPrefsToken, setMarketingOptOut } from "./email-prefs";

/**
 * The two buttons on `/email/<token>`.
 *
 * A button and a POST, never the GET: corporate mail scanners and link previewers open every URL in
 * a message, and an unsubscribe that fired on GET would quietly opt guests out who never clicked.
 * The mail client's own one-click button posts to `/api/unsubscribe/<token>` (RFC 8058) instead.
 */
export async function updateEmailPrefs(token: string, optOut: boolean): Promise<void> {
  const guest = await guestByPrefsToken(token);
  if (guest) await setMarketingOptOut(guest, optOut);
  redirect(`/email/${encodeURIComponent(token)}?done=${optOut ? "out" : "in"}`);
}
