"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { completePasswordSet, requestPasswordReset } from "@revio/db";
import { sendEmail } from "@revio/email";

/**
 * Invite and password-reset actions. The rules live in @revio/core, the storage in @revio/db; this
 * file is only the wiring — resolve our own origin, hand the rendered mail to the transport, and be
 * careful about what the screen is allowed to reveal.
 */

const SCOPE = "crs" as const;
const CONTEXT = "RevioCRS";

/** Our own public origin, taken from the request — the app does not otherwise know its own URL. */
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type AccountResult = { error?: string; sent?: boolean };

/**
 * Ask for a reset link.
 *
 * Returns `sent: true` for every input — a real address, a deactivated account, a suspended hotel,
 * or something nobody has ever used. Reporting the difference would turn this form into a way to
 * find out who works at a hotel.
 */
export async function requestReset(_prev: AccountResult | null, fd: FormData): Promise<AccountResult> {
  const email = String(fd.get("email") ?? "");
  const { email: mail } = await requestPasswordReset({
    scope: SCOPE,
    email,
    origin: await currentOrigin(),
    contextName: CONTEXT,
  });
  if (mail) await sendEmail({ to: [mail.to], subject: mail.subject, text: mail.text });
  return { sent: true };
}

/** Spend an invite or reset link and set the chosen password. */
export async function setPassword(_prev: AccountResult | null, fd: FormData): Promise<AccountResult> {
  const token = String(fd.get("token") ?? "");
  const purpose = String(fd.get("purpose") ?? "reset") === "invite" ? "invite" : "reset";
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (password !== confirm) return { error: "Those two passwords don't match." };

  const result = await completePasswordSet({ token, purpose, password, contextName: CONTEXT });
  if (!result.ok) return { error: result.message };

  if (result.email) {
    await sendEmail({ to: [result.email.to], subject: result.email.subject, text: result.email.text });
  }
  redirect("/login?passwordSet=1");
}
