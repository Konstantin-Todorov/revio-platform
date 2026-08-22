import { EMAIL_TEMPLATES, EMAIL_TEMPLATE_BY_KEY, renderEmail, defaultsFor, type EmailBrand } from "@revio/core";

/**
 * A stored template row — the hotel's own wording for one email in one language.
 */
export interface EmailTemplateRow {
  key: string;
  enabled: boolean;
  subject: string;
  body: string;
}

/**
 * The Prisma surface this engine needs, structurally typed.
 *
 * Passed in rather than imported, exactly like the connectivity package: the CALLER owns the tenant
 * perimeter decision, so one implementation serves a staff request (tenant-scoped client) and an
 * anonymous booking (resolved from a public slug through the system perimeter).
 */
export interface EmailDb {
  property: { findUnique: (args: { where: { id: string } }) => Promise<PropertyEmailBrandRow & { defaultLanguage?: string | null } | null> };
  emailTemplate: {
    findMany: (args: { where: { propertyId: string; locale: string } }) => Promise<EmailTemplateRow[]>;
    findUnique: (args: {
      where: { propertyId_key_locale: { propertyId: string; key: string; locale: string } };
    }) => Promise<EmailTemplateRow | null>;
  };
}
import { sendEmail } from "./transport.js";

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
  emailLogoVersion: number;
  emailBrandColor: string | null;
  emailFooterText: string | null;
  emailTheme: string;
  emailFont: string;
}

/**
 * Where the app is reachable from the outside. A guest's mail client fetches the logo from here, so
 * it must be an absolute, public URL — a relative path renders as a broken image in every inbox.
 * Railway injects RAILWAY_PUBLIC_DOMAIN; PUBLIC_BASE_URL overrides it once a custom domain exists.
 */
export function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railway) return `https://${railway}`;
  return "http://localhost:3000";
}

/** An uploaded logo wins over a pasted URL — it's the one we can guarantee still resolves. */
function logoUrlFor(property: PropertyEmailBrandRow): string | null {
  if (property.emailLogoVersion > 0) {
    return `${publicBaseUrl()}/api/brand/${property.id}/logo?v=${property.emailLogoVersion}`;
  }
  return property.emailLogoUrl;
}

export function brandOf(property: PropertyEmailBrandRow): EmailBrand {
  return {
    propertyName: property.name,
    senderName: property.emailSenderName,
    replyTo: property.emailReplyTo,
    logoUrl: logoUrlFor(property),
    brandColor: property.emailBrandColor,
    footerText: property.emailFooterText,
    theme: property.emailTheme,
    font: property.emailFont,
  };
}

/** Every template for a property IN ONE LANGUAGE, saved-or-default (drives the Settings screen). */
export async function listPropertyTemplates(db: EmailDb, propertyId: string, locale = "en") {
  const saved = await db.emailTemplate.findMany({ where: { propertyId, locale } });
  const byKey = new Map(saved.map((t) => [t.key, t] as const));
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
export async function sendTemplatedEmail(db: EmailDb, args: {
  propertyId: string;
  key: string;
  to: string[];
  vars: Record<string, string>;
  /** The guest's language when known; falls back to the property default, then English. */
  locale?: string | null;
  /**
   * The stay itself — dates, room, total — rendered into the template's `{{details}}` block.
   *
   * Without these a "confirmation" arrives with no dates and no price, which is not a confirmation.
   * They are passed rather than looked up because the caller has just computed them and a second
   * query could disagree with what the guest was shown.
   */
  details?: { label: string; value: string; emphasis?: boolean }[];
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const def = EMAIL_TEMPLATE_BY_KEY[args.key];
  if (!def) return { ok: false, error: `Unknown email template "${args.key}"` };
  if (args.to.length === 0) return { ok: true, skipped: true };

  const property = await db.property.findUnique({ where: { id: args.propertyId } });
  if (!property) return { ok: false, error: "Unknown property" };

  // Language: the guest's own, else the property default, else English.
  const locale = args.locale?.trim() || property.defaultLanguage || "en";
  const row =
    (await db.emailTemplate.findUnique({
      where: { propertyId_key_locale: { propertyId: args.propertyId, key: args.key, locale } },
    })) ??
    (locale !== "en"
      ? await db.emailTemplate.findUnique({
          where: { propertyId_key_locale: { propertyId: args.propertyId, key: args.key, locale: "en" } },
        })
      : null);
  if (row && !row.enabled) return { ok: true, skipped: true };

  const fallback = defaultsFor(def, locale);
  const brand = brandOf(property);
  const rendered = renderEmail({
    subject: row?.subject ?? fallback.subject,
    body: row?.body ?? fallback.body,
    brand,
    vars: args.vars,
    ...(args.details?.length ? { details: args.details } : {}),
  });

  // The guest reads the hotel's name in From and replies to the hotel — not to Revio. The mail is
  // still sent from (and DKIM-signed by) our verified address; only the display name and Reply-To
  // are the hotel's. See `resolveFrom` in transport.ts for why we can't send "as" their own domain.
  const res = await sendEmail({
    to: args.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    fromName: brand.senderName ?? null,
    replyTo: brand.replyTo ?? null,
  });
  return res.ok ? { ok: true } : { ok: false, ...(res.error ? { error: res.error } : {}) };
}
