"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import {
  beginUserTotpEnrolment, confirmUserTotpEnrolment, disableUserTotp, forSystem,
} from "@revio/db";
import type { TwoFactorState } from "@revio/ui/two-factor-setup";
import { getSession } from "./session";

export type { TwoFactorState };

/**
 * Turning two-factor authentication on and off for YOUR OWN account.
 *
 * Every action here acts on the caller's own id, taken from the session and never from the form. A
 * manager turning 2FA on for a colleague — or off for one — would be a privilege escalation dressed
 * as a settings page: the whole point of the second factor is that it belongs to one person's phone.
 *
 * The account is shared across RevioLink, RevioCRS and RevioPMS, so enrolling here protects all
 * three. The screen says so, because somebody who turns it on in one product and is then challenged
 * in another should have been told, not surprised.
 */

/**
 * The QR is rendered on the SERVER, next to the secret it encodes.
 *
 * Sending the `otpauth://` URI to the browser and drawing it there would put the shared secret into
 * a client bundle's data and into React's serialised props — the one value in this flow that must
 * travel as little as possible. A data URL is an image; the secret never becomes a string the page
 * can accidentally log, echo into an error boundary, or leave in a cached RSC payload.
 */
async function qrFor(uri: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 320 });
  } catch {
    // A missing QR is a degraded setup, not a failed one — the key is shown for manual entry beside
    // it, and every authenticator app accepts that.
    return null;
  }
}

export async function startTwoFactor(): Promise<TwoFactorState> {
  const session = await getSession();
  if (!session) return { step: "idle", error: "Sign in again." };
  const offer = await beginUserTotpEnrolment(session.tenantId, session.userId, "Revio");
  return { step: "enrolling", secret: offer.secret, uri: offer.uri, qrDataUrl: await qrFor(offer.uri) };
}

export async function confirmTwoFactor(_prev: TwoFactorState | null, fd: FormData): Promise<TwoFactorState> {
  const session = await getSession();
  if (!session) return { step: "idle", error: "Sign in again." };

  const secret = String(fd.get("secret") ?? "");
  const uri = String(fd.get("uri") ?? "");
  const code = String(fd.get("code") ?? "");

  const result = await confirmUserTotpEnrolment({
    tenantId: session.tenantId, userId: session.userId, code, scope: "pms",
  });
  if (!result.ok) {
    // Stay on the enrolling step with the SAME secret on screen. Re-minting one here would silently
    // invalidate the QR they have already scanned, so a mistyped digit would send them round the
    // whole setup again for no reason.
    return { step: "enrolling", secret, uri, qrDataUrl: await qrFor(uri), error: result.error };
  }
  revalidatePath("/settings");
  return { step: "done", recoveryCodes: result.recoveryCodes ?? [] };
}

/**
 * Turn it off — requires the current password, not just a live session.
 *
 * An unattended laptop must not be enough to remove the protection that exists precisely for the
 * case where somebody else has your laptop.
 */
export async function turnOffTwoFactor(
  _prev: { error?: string } | null,
  fd: FormData,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sign in again." };

  const password = String(fd.get("password") ?? "");
  if (!password) return { error: "Enter your password to turn two-factor off." };

  const { verifyPassword } = await import("./auth");
  const user = await forSystem().user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That password is not right." };
  }

  await disableUserTotp({ tenantId: session.tenantId, userId: session.userId, scope: "pms" });
  revalidatePath("/settings");
  return {};
}
