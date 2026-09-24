import { EMAIL_LOCALES, EMAIL_TEMPLATE_BY_KEY, defaultsFor } from "@revio/core";

/**
 * The writes behind the Guest emails screen — one implementation for RevioLink, RevioCRS and
 * RevioPMS, which all show the same screen over the same rows.
 *
 * Each app keeps its own server actions, because the perimeter is per product (its own session, its
 * own capability names, its own audit log); what they do to the database is this file. Three copies
 * of "save a template" would drift, and the copy that drifts is the one that forgets that a
 * confirmation may never be switched off.
 *
 * Structurally typed, like `EmailDb`: the caller passes its tenant-scoped client.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- a structural slice of the Prisma client */
export interface EmailSettingsDb {
  emailTemplate: {
    findMany: (args: any) => Promise<{ key: string; locale: string; enabled: boolean }[]>;
    upsert: (args: any) => Promise<unknown>;
    deleteMany: (args: any) => Promise<unknown>;
  };
  property: { update: (args: any) => Promise<unknown> };
  brandAsset: { upsert: (args: any) => Promise<unknown>; deleteMany: (args: any) => Promise<unknown> };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const isEmailLocale = (l: string): boolean => EMAIL_LOCALES.some((x) => x.key === l);

/** Every saved row's state, per template, per language — what the list shows beside each email. */
export async function templateStates(db: EmailSettingsDb, propertyId: string): Promise<
  Record<string, { edited: string[]; off: string[] }>
> {
  const rows = await db.emailTemplate.findMany({ where: { propertyId }, select: { key: true, locale: true, enabled: true } });
  const out: Record<string, { edited: string[]; off: string[] }> = {};
  for (const r of rows) {
    const s = (out[r.key] ??= { edited: [], off: [] });
    s.edited.push(r.locale);
    if (!r.enabled) s.off.push(r.locale);
  }
  return out;
}

/** Save one email's wording and switch in one language. Returns false for an unknown email. */
export async function saveTemplate(db: EmailSettingsDb, args: {
  tenantId: string; propertyId: string; key: string; locale: string;
  subject: string; body: string; enabled: boolean; userId: string | null;
}): Promise<{ ok: boolean; label?: string; enabled?: boolean }> {
  const def = EMAIL_TEMPLATE_BY_KEY[args.key];
  if (!def || !isEmailLocale(args.locale)) return { ok: false };
  // A confirmation is a transactional obligation, not a marketing choice — enforced here, not only in
  // the UI, because a form field is whatever the browser sends.
  const enabled = def.canDisable ? args.enabled : true;
  const fallback = defaultsFor(def, args.locale);
  const subject = args.subject.trim() || fallback.subject;
  const body = args.body.trim() || fallback.body;
  const { tenantId, propertyId, key, locale, userId } = args;
  await db.emailTemplate.upsert({
    where: { propertyId_key_locale: { propertyId, key, locale } },
    create: { tenantId, propertyId, key, locale, enabled, subject, body, updatedBy: userId },
    update: { enabled, subject, body, updatedBy: userId },
  });
  return { ok: true, label: def.label, enabled };
}

/** Back to our wording for one email in one language — the hotel's row is deleted. */
export async function resetTemplate(db: EmailSettingsDb, propertyId: string, key: string, locale: string): Promise<void> {
  await db.emailTemplate.deleteMany({ where: { propertyId, key, locale } });
}

/** The branding every guest email carries. Blank means "use ours" for each field. */
export async function saveBranding(db: EmailSettingsDb, propertyId: string, v: {
  senderName: string; replyTo: string; brandColor: string; footerText: string; theme: string; font: string;
}): Promise<void> {
  await db.property.update({
    where: { id: propertyId },
    data: {
      emailSenderName: v.senderName.trim() || null,
      emailReplyTo: v.replyTo.trim() || null,
      emailBrandColor: v.brandColor.trim() || null,
      emailFooterText: v.footerText.trim() || null,
      emailTheme: v.theme || "classic",
      emailFont: v.font || "serif",
    },
  });
}

/** The language guests receive when we do not know theirs. False for a language we do not send in. */
export async function setGuestLanguage(db: EmailSettingsDb, propertyId: string, locale: string): Promise<boolean> {
  if (!isEmailLocale(locale)) return false;
  await db.property.update({ where: { id: propertyId }, data: { defaultLanguage: locale } });
  return true;
}

/**
 * Formats a mail client will actually render. SVG is deliberately absent: it can carry script, and
 * no major email client renders it anyway.
 */
const LOGO_TYPES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
};
export const MAX_EMAIL_LOGO_BYTES = 300 * 1024;
export type LogoRefusal = "none" | "tooBig" | "notImage";

/**
 * Store an uploaded logo. The declared Content-Type is not trusted — the leading bytes are checked
 * against the real signature, so a renamed script can never be stored and served back as an image.
 */
export async function storeEmailLogo(db: EmailSettingsDb, args: {
  tenantId: string; propertyId: string; file: unknown;
}): Promise<{ ok: true; kb: number } | { ok: false; code: LogoRefusal; kb?: number }> {
  const file = args.file;
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: "none" };
  if (file.size > MAX_EMAIL_LOGO_BYTES) return { ok: false, code: "tooBig", kb: Math.round(file.size / 1024) };
  const bytes = Buffer.from(await file.arrayBuffer());
  const match = Object.entries(LOGO_TYPES).find(([, sig]) => sig.every((b, i) => bytes[i] === b));
  if (!match) return { ok: false, code: "notImage" };
  const [mimeType] = match;
  const { tenantId, propertyId } = args;
  await db.brandAsset.upsert({
    where: { propertyId_kind: { propertyId, kind: "email_logo" } },
    create: { tenantId, propertyId, kind: "email_logo", mimeType, bytes, byteSize: bytes.length },
    update: { mimeType, bytes, byteSize: bytes.length },
  });
  // A new version changes the ?v= in the public URL, so no inbox keeps the old logo from cache.
  await db.property.update({ where: { id: propertyId }, data: { emailLogoVersion: { increment: 1 }, emailLogoUrl: null } });
  return { ok: true, kb: Math.round(bytes.length / 1024) };
}

export async function removeEmailLogoRow(db: EmailSettingsDb, propertyId: string): Promise<void> {
  await db.brandAsset.deleteMany({ where: { propertyId, kind: "email_logo" } });
  await db.property.update({ where: { id: propertyId }, data: { emailLogoVersion: { increment: 1 } } });
}
