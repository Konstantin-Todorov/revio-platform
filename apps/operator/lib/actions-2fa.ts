"use server";

import { revalidatePath } from "next/cache";
import { beginTotpEnrolment, confirmTotpEnrolment, disableTotp, forSystem } from "@revio/db";
import QRCode from "qrcode";
import { getOperatorSession } from "./session";

/**
 * The QR is rendered on the SERVER, next to the secret it encodes.
 *
 * Sending the `otpauth://` URI to the browser and drawing it there would put the shared secret into
 * a client bundle's data and into React's serialised props — the one value in this flow that must
 * travel as little as possible. A data URL is an image; the secret never becomes a string the page
 * can accidentally log, echo into an error boundary, or leave in a cached RSC payload beyond the
 * one it is displayed in.
 */
async function qrFor(uri: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 320 });
  } catch {
    // A missing QR is a degraded setup, not a failed one — the key is shown for manual entry
    // alongside it, and every authenticator app accepts that.
    return null;
  }
}

/**
 * Enrolling and un-enrolling in two-factor authentication (N4).
 *
 * Every action here acts on the CALLER'S OWN account — the id comes from the session and is never
 * accepted from the form. An operator turning on 2FA for a colleague, or off for one, would be a
 * privilege escalation dressed as a settings page: the whole point of the second factor is that it
 * belongs to one person's phone.
 */

export type TwoFactorState =
  | { step: "idle"; error?: string }
  | { step: "enrolling"; secret: string; uri: string; qrDataUrl: string | null; error?: string }
  | { step: "done"; recoveryCodes: string[] };

export async function startTwoFactor(): Promise<TwoFactorState> {
  const session = await getOperatorSession();
  if (!session) return { step: "idle", error: "Sign in again." };
  const offer = await beginTotpEnrolment(session.userId);
  return { step: "enrolling", secret: offer.secret, uri: offer.uri, qrDataUrl: await qrFor(offer.uri) };
}

export async function confirmTwoFactor(_prev: TwoFactorState | null, fd: FormData): Promise<TwoFactorState> {
  const session = await getOperatorSession();
  if (!session) return { step: "idle", error: "Sign in again." };

  const secret = String(fd.get("secret") ?? "");
  const uri = String(fd.get("uri") ?? "");
  const code = String(fd.get("code") ?? "");

  const result = await confirmTotpEnrolment(session.userId, code);
  if (!result.ok) {
    // Stay on the enrolling step and keep the SAME secret on screen. Re-minting one here would
    // silently invalidate the QR they have already scanned, so a mistyped digit would send them
    // round the setup again for no reason.
    return { step: "enrolling", secret, uri, qrDataUrl: await qrFor(uri), error: result.error };
  }
  revalidatePath("/settings");
  return { step: "done", recoveryCodes: result.recoveryCodes ?? [] };
}

/**
 * Turn it off.
 *
 * Requires the current password, not just a live session: an unattended laptop should not be enough
 * to remove the protection that exists for the case where somebody else has your laptop.
 */
export async function turnOffTwoFactor(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const session = await getOperatorSession();
  if (!session) return { error: "Sign in again." };

  const password = String(fd.get("password") ?? "");
  if (!password) return { error: "Enter your password to turn two-factor off." };

  const { verifyPassword } = await import("./auth");
  const op = await forSystem().operatorUser.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });
  if (!op?.passwordHash || !(await verifyPassword(password, op.passwordHash))) {
    return { error: "That password is not right." };
  }

  await disableTotp(session.userId);
  revalidatePath("/settings");
  return {};
}
