"use server";

import { revalidatePath } from "next/cache";
import { EMAIL_TEMPLATE_BY_KEY, defaultsFor } from "@revio/core";
import { prisma } from "./db";
import { getProperty } from "./data";
import { getSession } from "./session";
import { logAudit, str } from "./mutation-helpers";

/** Save this property's guest-email branding (sender name, reply-to, logo, colour, footer). */
export async function saveEmailBranding(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const session = await getSession();
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      emailSenderName: str(fd, "emailSenderName") || null,
      emailReplyTo: str(fd, "emailReplyTo") || null,
      emailLogoUrl: str(fd, "emailLogoUrl") || null,
      emailBrandColor: str(fd, "emailBrandColor") || null,
      emailFooterText: str(fd, "emailFooterText") || null,
      emailTheme: str(fd, "emailTheme") || "classic",
      emailFont: str(fd, "emailFont") || "serif",
    },
  });
  await logAudit(propertyId, tenantId, {
    entity: "Email settings", field: "branding", newValue: "updated",
  });
  revalidatePath("/settings/emails");
}

/** Save one email template's wording + on/off switch. Upserts, so the row only exists once customised. */
export async function saveEmailTemplate(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const session = await getSession();
  const key = str(fd, "key");
  const locale = str(fd, "locale") || "en";
  const def = EMAIL_TEMPLATE_BY_KEY[key];
  if (!def) return;

  // A confirmation/cancellation is a transactional obligation, not a marketing choice — the catalogue
  // marks those canDisable:false and we enforce it here too, not only in the UI.
  const enabled = def.canDisable ? fd.get("enabled") != null : true;
  const fallback = defaultsFor(def, locale);
  const subject = str(fd, "subject").trim() || fallback.subject;
  const body = str(fd, "body").trim() || fallback.body;

  await prisma.emailTemplate.upsert({
    where: { propertyId_key_locale: { propertyId, key, locale } },
    create: { tenantId, propertyId, key, locale, enabled, subject, body, updatedBy: session?.userId ?? null },
    update: { enabled, subject, body, updatedBy: session?.userId ?? null },
  });
  await logAudit(propertyId, tenantId, {
    entity: "Email settings", field: def.label,
    newValue: enabled ? "saved" : "saved (switched off)",
  });
  revalidatePath("/settings/emails");
}

/** Revert one email to the platform default wording (deletes the customisation row). */
export async function resetEmailTemplate(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const session = await getSession();
  const key = str(fd, "key");
  const locale = str(fd, "locale") || "en";
  await prisma.emailTemplate.deleteMany({ where: { propertyId, key, locale } });
  await logAudit(propertyId, tenantId, {
    entity: "Email settings", field: EMAIL_TEMPLATE_BY_KEY[key]?.label ?? key,
    newValue: "reset to default",
  });
  revalidatePath("/settings/emails");
}

// --- Logo upload -------------------------------------------------------------

/**
 * Formats a mail client will actually render. SVG is deliberately absent: it can carry script, and
 * no major email client renders it anyway, so accepting it would be all risk and no benefit.
 */
const LOGO_TYPES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
};
const MAX_LOGO_BYTES = 300 * 1024;

export type UploadResult = { ok: boolean; error?: string };

/**
 * Store an uploaded logo and point the property's email branding at our own hosted copy.
 *
 * The declared Content-Type is not trusted — a browser will send whatever the file claims. The
 * leading bytes are checked against the real signature, so a renamed script can't be stored and
 * later served back as an image.
 */
export async function uploadEmailLogo(_prev: UploadResult | null, fd: FormData): Promise<UploadResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image first." };
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: `That image is ${Math.round(file.size / 1024)} KB. Please use one under 300 KB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const match = Object.entries(LOGO_TYPES).find(([, sig]) => sig.every((b, i) => bytes[i] === b));
  if (!match) return { ok: false, error: "That file isn’t a PNG, JPEG or GIF. Email clients can’t show other formats." };
  const [mimeType] = match;

  await prisma.brandAsset.upsert({
    where: { propertyId_kind: { propertyId, kind: "email_logo" } },
    create: { tenantId, propertyId, kind: "email_logo", mimeType, bytes, byteSize: bytes.length },
    update: { mimeType, bytes, byteSize: bytes.length },
  });
  // Bumping the version changes the ?v= in the public URL, so a client holding the old logo in
  // cache fetches the new one instead of showing the previous brand forever.
  await prisma.property.update({
    where: { id: propertyId },
    data: { emailLogoVersion: { increment: 1 }, emailLogoUrl: null },
  });

  await logAudit(propertyId, tenantId, {
    entity: "Email settings", field: "logo", newValue: `uploaded (${Math.round(bytes.length / 1024)} KB)`,
  });
  revalidatePath("/settings/emails");
  return { ok: true };
}

/** Remove the uploaded logo — emails fall back to the hotel's name as a wordmark. */
export async function removeEmailLogo(): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  await prisma.brandAsset.deleteMany({ where: { propertyId, kind: "email_logo" } });
  await prisma.property.update({ where: { id: propertyId }, data: { emailLogoVersion: { increment: 1 } } });
  await logAudit(propertyId, tenantId, { entity: "Email settings", field: "logo", newValue: "removed" });
  revalidatePath("/settings/emails");
}
