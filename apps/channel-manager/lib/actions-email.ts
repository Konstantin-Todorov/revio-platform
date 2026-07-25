"use server";

import { revalidatePath } from "next/cache";
import { EMAIL_TEMPLATE_BY_KEY } from "@revio/core";
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
  const def = EMAIL_TEMPLATE_BY_KEY[key];
  if (!def) return;

  // A confirmation/cancellation is a transactional obligation, not a marketing choice — the catalogue
  // marks those canDisable:false and we enforce it here too, not only in the UI.
  const enabled = def.canDisable ? fd.get("enabled") != null : true;
  const subject = str(fd, "subject").trim() || def.defaultSubject;
  const body = str(fd, "body").trim() || def.defaultBody;

  await prisma.emailTemplate.upsert({
    where: { propertyId_key: { propertyId, key } },
    create: { tenantId, propertyId, key, enabled, subject, body, updatedBy: session?.userId ?? null },
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
  await prisma.emailTemplate.deleteMany({ where: { propertyId, key } });
  await logAudit(propertyId, tenantId, {
    entity: "Email settings", field: EMAIL_TEMPLATE_BY_KEY[key]?.label ?? key,
    newValue: "reset to default",
  });
  revalidatePath("/settings/emails");
}
