import "server-only";
import { EMAIL_TEMPLATES, EMAIL_TEMPLATE_BY_KEY, renderEmail, defaultsFor, type EmailBrand } from "@revio/core";
import { prisma } from "./db";
import { sendEmail } from "./email";

/**
 * The email engine's app half: resolve a property's template + branding, render, and send.
 *
 * Resolution order for each email type:
 *   1. the hotel's saved EmailTemplate row (their wording, their on/off switch), else
 *   2. the platform default from @revio/core — so a brand-new property sends correct mail on day one
 *      with nothing configured.
 *
 * A disabled template is a no-op: the hotel decided their guests don't get that email.
 */

export interface PropertyEmailBrandRow {
  id: string;
  name: string;
  emailSenderName: string | null;
  emailReplyTo: string | null;
  emailLogoUrl: string | null;
  emailBrandColor: string | null;
  emailFooterText: string | null;
  emailTheme: string;
  emailFont: string;
}

export function brandOf(property: PropertyEmailBrandRow): EmailBrand {
  return {
    propertyName: property.name,
    senderName: property.emailSenderName,
    replyTo: property.emailReplyTo,
    logoUrl: property.emailLogoUrl,
    brandColor: property.emailBrandColor,
    footerText: property.emailFooterText,
    theme: property.emailTheme,
    font: property.emailFont,
  };
}

/** Every template for a property IN ONE LANGUAGE, saved-or-default (drives the Settings screen). */
export async function listPropertyTemplates(propertyId: string, locale = "en") {
  const saved = await prisma.emailTemplate.findMany({ where: { propertyId, locale } });
  const byKey = new Map(saved.map((t) => [t.key, t]));
  return EMAIL_TEMPLATES.map((def) => {
    const row = byKey.get(def.key);
    const fallback = defaultsFor(def, locale);
    return {
      def,
      enabled: row?.enabled ?? true,
      subject: row?.subject ?? fallback.subject,
      body: row?.body ?? fallback.body,
      customised: Boolean(row),
    };
  });
}

/**
 * Send one templated email. Returns `skipped` when the hotel switched that email off, so callers can
 * tell "the hotel doesn't want this" apart from "sending failed".
 */
export async function sendTemplatedEmail(args: {
  propertyId: string;
  key: string;
  to: string[];
  vars: Record<string, string>;
  /** The guest's language when known; falls back to the property default, then English. */
  locale?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const def = EMAIL_TEMPLATE_BY_KEY[args.key];
  if (!def) return { ok: false, error: `Unknown email template "${args.key}"` };
  if (args.to.length === 0) return { ok: true, skipped: true };

  const property = await prisma.property.findUnique({ where: { id: args.propertyId } });
  if (!property) return { ok: false, error: "Unknown property" };

  // Language: the guest's own, else the property default, else English.
  const locale = args.locale?.trim() || property.defaultLanguage || "en";
  const row =
    (await prisma.emailTemplate.findUnique({
      where: { propertyId_key_locale: { propertyId: args.propertyId, key: args.key, locale } },
    })) ??
    (locale !== "en"
      ? await prisma.emailTemplate.findUnique({
          where: { propertyId_key_locale: { propertyId: args.propertyId, key: args.key, locale: "en" } },
        })
      : null);
  if (row && !row.enabled) return { ok: true, skipped: true };

  const fallback = defaultsFor(def, locale);
  const rendered = renderEmail({
    subject: row?.subject ?? fallback.subject,
    body: row?.body ?? fallback.body,
    brand: brandOf(property),
    vars: args.vars,
  });

  const res = await sendEmail({ to: args.to, subject: rendered.subject, text: rendered.text });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
