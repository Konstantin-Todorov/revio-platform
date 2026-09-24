"use server";

import { revalidatePath } from "next/cache";
import { EMAIL_TEMPLATE_BY_KEY } from "@revio/core";
import {
  removeEmailLogoRow, resetTemplate, saveBranding, saveTemplate, setGuestLanguage, storeEmailLogo,
} from "@revio/email";
import type { UploadResult } from "@revio/ui/email-logo-upload";
import { flashError, setFlash } from "@revio/ui/flash";
import { prisma } from "./db";
import { logAudit, str } from "./mutation-helpers";
import { requireCapability } from "./authz";
import { i18n } from "./i18n/server";
import { flash } from "./i18n/flash";

/** Who may change guest emails, and on which property. Null when they may not. */
async function ctx(cap: "manage"): Promise<{ tenantId: string; propertyId: string; userId: string | null } | null> {
  const session = await requireCapability(cap);
  if (!session) return null;
  return { tenantId: session.tenantId, propertyId: session.activePropertyId, userId: session.userId };
}

async function say() {
  return (await i18n()).t(flash).emails;
}

/**
 * Guest emails — this product's perimeter over the shared writes in `@revio/email/settings`.
 *
 * The same screen is in RevioLink, RevioCRS and RevioPMS over the same rows; each product keeps its
 * own actions because each has its own session and capability names. What they do to the database
 * is one implementation, so the three cannot disagree about, for example, whether a confirmation may
 * be switched off.
 */

function refresh() {
  revalidatePath("/settings/emails", "layout");
}

/** Save one email's wording and on/off switch in one language. */
export async function saveEmailTemplate(fd: FormData): Promise<void> {
  const c = await ctx("manage");
  if (!c) return flashError((await say()).denied);
  const key = str(fd, "key");
  const locale = str(fd, "locale") || "en";
  const saved = await saveTemplate(prisma, {
    tenantId: c.tenantId, propertyId: c.propertyId, key, locale,
    subject: str(fd, "subject"), body: str(fd, "body"), enabled: fd.get("enabled") != null, userId: c.userId,
  });
  if (!saved.ok) return flashError((await say()).gone);
  await logAudit(c.propertyId, c.tenantId, {
    entity: "Email settings", field: `${saved.label} (${locale})`, newValue: saved.enabled ? "saved" : "saved (switched off)",
  });
  refresh();
}

/** Back to our wording for one email in one language. */
export async function resetEmailTemplate(fd: FormData): Promise<void> {
  const c = await ctx("manage");
  if (!c) return flashError((await say()).denied);
  const key = str(fd, "key");
  const locale = str(fd, "locale") || "en";
  await resetTemplate(prisma, c.propertyId, key, locale);
  await logAudit(c.propertyId, c.tenantId, {
    entity: "Email settings", field: `${EMAIL_TEMPLATE_BY_KEY[key]?.label ?? key} (${locale})`, newValue: "reset to default",
  });
  refresh();
}

/** Sender, reply-to, colour, footer, design and typeface — the look every guest email carries. */
export async function saveEmailBranding(fd: FormData): Promise<void> {
  const c = await ctx("manage");
  if (!c) return flashError((await say()).denied);
  await saveBranding(prisma, c.propertyId, {
    senderName: str(fd, "emailSenderName"), replyTo: str(fd, "emailReplyTo"), brandColor: str(fd, "emailBrandColor"),
    footerText: str(fd, "emailFooterText"), theme: str(fd, "emailTheme"), font: str(fd, "emailFont"),
  });
  await logAudit(c.propertyId, c.tenantId, { entity: "Email settings", field: "branding", newValue: "updated" });
  refresh();
  await setFlash("success", (await say()).savedLook);
}

/**
 * Which language guests receive. A real, saved choice — the only one on the screen that changes what
 * a guest actually gets — stored on the property, because a chain can run one hotel in Bulgarian and
 * another in English.
 */
export async function setDefaultLanguage(fd: FormData): Promise<void> {
  const c = await ctx("manage");
  if (!c) return flashError((await say()).denied);
  const locale = str(fd, "locale");
  if (!(await setGuestLanguage(prisma, c.propertyId, locale))) {
    return flashError((await say()).notALanguage);
  }
  await logAudit(c.propertyId, c.tenantId, { entity: "Email settings", field: "guest language", newValue: locale });
  refresh();
}

/** Store an uploaded logo — checked by its bytes, not by what the browser says it is. */
export async function uploadEmailLogo(_prev: UploadResult | null, fd: FormData): Promise<UploadResult> {
  const c = await ctx("manage");
  if (!c) return { ok: false, error: (await say()).denied };
  const res = await storeEmailLogo(prisma, { tenantId: c.tenantId, propertyId: c.propertyId, file: fd.get("logo") });
  if (!res.ok) return { ok: false, code: res.code, ...(res.kb !== undefined ? { kb: res.kb } : {}) };
  await logAudit(c.propertyId, c.tenantId, { entity: "Email settings", field: "logo", newValue: `uploaded (${res.kb} KB)` });
  refresh();
  return { ok: true };
}

/** Remove the uploaded logo — emails fall back to the hotel's name as a wordmark. */
export async function removeEmailLogo(): Promise<void> {
  const c = await ctx("manage");
  if (!c) return flashError((await say()).denied);
  await removeEmailLogoRow(prisma, c.propertyId);
  await logAudit(c.propertyId, c.tenantId, { entity: "Email settings", field: "logo", newValue: "removed" });
  refresh();
}
