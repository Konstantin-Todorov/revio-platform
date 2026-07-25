import "server-only";
import { EMAIL_TEMPLATES, EMAIL_TEMPLATE_BY_KEY, renderEmail, type EmailBrand } from "@revio/core";
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
}

export function brandOf(property: PropertyEmailBrandRow): EmailBrand {
  return {
    propertyName: property.name,
    senderName: property.emailSenderName,
    replyTo: property.emailReplyTo,
    logoUrl: property.emailLogoUrl,
    brandColor: property.emailBrandColor,
    footerText: property.emailFooterText,
  };
}

/** Every template for a property, saved-or-default, in catalogue order (drives the Settings screen). */
export async function listPropertyTemplates(propertyId: string) {
  const saved = await prisma.emailTemplate.findMany({ where: { propertyId } });
  const byKey = new Map(saved.map((t) => [t.key, t]));
  return EMAIL_TEMPLATES.map((def) => {
    const row = byKey.get(def.key);
    return {
      def,
      enabled: row?.enabled ?? true,
      subject: row?.subject ?? def.defaultSubject,
      body: row?.body ?? def.defaultBody,
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
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const def = EMAIL_TEMPLATE_BY_KEY[args.key];
  if (!def) return { ok: false, error: `Unknown email template "${args.key}"` };
  if (args.to.length === 0) return { ok: true, skipped: true };

  const property = await prisma.property.findUnique({ where: { id: args.propertyId } });
  if (!property) return { ok: false, error: "Unknown property" };

  const row = await prisma.emailTemplate.findUnique({
    where: { propertyId_key: { propertyId: args.propertyId, key: args.key } },
  });
  if (row && !row.enabled) return { ok: true, skipped: true };

  const rendered = renderEmail({
    subject: row?.subject ?? def.defaultSubject,
    body: row?.body ?? def.defaultBody,
    brand: brandOf(property),
    vars: args.vars,
  });

  const res = await sendEmail({ to: args.to, subject: rendered.subject, text: rendered.text });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
