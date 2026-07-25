/**
 * The email engine's shared half: the catalogue of every email the platform can send, the platform
 * default wording for each, and a pure renderer.
 *
 * Design rules:
 *  - **One catalogue, all products.** RevioLink, RevioCRS and RevioPMS all send from this list, so a
 *    hotel configures its guest communication in one place rather than three.
 *  - **Defaults that work on day one.** A property with nothing configured still sends correct,
 *    professional mail — a hotel only stores a row when it actually customises something.
 *  - **Plain text with {{placeholders}}, not a rich editor.** A hotel cannot break rendering,
 *    accessibility or deliverability by pasting styled HTML. Branding is applied by us at render time.
 *  - **Pure.** No DB, no network — so it is trivially testable and usable from any app.
 */

export type EmailAudience = "guest" | "staff";

export interface EmailTemplateDef {
  key: string;
  label: string;
  description: string;
  audience: EmailAudience;
  /** Variables a hotel may use in this template, with an example value for the preview. */
  variables: Record<string, string>;
  defaultSubject: string;
  defaultBody: string;
  /** Guest-facing mail a hotel may reasonably switch off; transactional confirmations shouldn't be. */
  canDisable: boolean;
}

const GUEST_COMMON = {
  guestName: "Elena Petrova",
  propertyName: "Hotel Sofia",
  checkIn: "2026-08-14",
  checkOut: "2026-08-17",
  nights: "3",
  roomType: "Deluxe Double Room",
  reference: "RV-10482",
  total: "€540",
};

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: "booking_confirmation",
    label: "Booking confirmation",
    description: "Sent to the guest the moment a reservation is confirmed.",
    audience: "guest",
    canDisable: false,
    variables: { ...GUEST_COMMON },
    defaultSubject: "Your booking at {{propertyName}} is confirmed — {{reference}}",
    defaultBody: `Dear {{guestName}},

Thank you for booking with {{propertyName}}. Your reservation is confirmed.

Reference: {{reference}}
Arrival: {{checkIn}}
Departure: {{checkOut}} ({{nights}} nights)
Room: {{roomType}}
Total: {{total}}

We look forward to welcoming you. If you need to change anything, simply reply to this email.

Kind regards,
{{propertyName}}`,
  },
  {
    key: "booking_modified",
    label: "Booking changed",
    description: "Sent when dates, room or occupancy change on an existing reservation.",
    audience: "guest",
    canDisable: false,
    variables: { ...GUEST_COMMON },
    defaultSubject: "Your booking has been updated — {{reference}}",
    defaultBody: `Dear {{guestName}},

Your reservation at {{propertyName}} has been updated. Here are the current details:

Reference: {{reference}}
Arrival: {{checkIn}}
Departure: {{checkOut}} ({{nights}} nights)
Room: {{roomType}}
Total: {{total}}

If anything here looks wrong, please reply to this email and we will correct it.

Kind regards,
{{propertyName}}`,
  },
  {
    key: "booking_cancelled",
    label: "Booking cancelled",
    description: "Confirms a cancellation so the guest has it in writing.",
    audience: "guest",
    canDisable: false,
    variables: { ...GUEST_COMMON },
    defaultSubject: "Your booking has been cancelled — {{reference}}",
    defaultBody: `Dear {{guestName}},

Your reservation at {{propertyName}} (reference {{reference}}, arriving {{checkIn}}) has been cancelled.

If this was not your intention, please contact us as soon as possible.

Kind regards,
{{propertyName}}`,
  },
  {
    key: "pre_arrival",
    label: "Before arrival",
    description: "A friendly note a few days before check-in — directions, check-in time, extras.",
    audience: "guest",
    canDisable: true,
    variables: { ...GUEST_COMMON, checkInTime: "14:00" },
    defaultSubject: "Looking forward to seeing you at {{propertyName}}",
    defaultBody: `Dear {{guestName}},

We are looking forward to welcoming you on {{checkIn}}. Check-in opens at {{checkInTime}}.

If you would like to arrange an early arrival, airport transfer or anything else before you travel,
just reply to this email and we will be glad to help.

See you soon,
{{propertyName}}`,
  },
  {
    key: "post_stay",
    label: "After departure",
    description: "A thank-you after check-out. A natural place to invite a review or a direct rebooking.",
    audience: "guest",
    canDisable: true,
    variables: { ...GUEST_COMMON },
    defaultSubject: "Thank you for staying with us at {{propertyName}}",
    defaultBody: `Dear {{guestName}},

Thank you for staying with us. We hope you enjoyed your time at {{propertyName}}.

If you have a moment, we would genuinely appreciate your feedback — and if you book with us directly
next time, we will always do our best to look after you.

Safe travels,
{{propertyName}}`,
  },
  {
    key: "folio_receipt",
    label: "Bill / receipt",
    description: "Sends the guest their itemised bill after check-out.",
    audience: "guest",
    canDisable: true,
    variables: { ...GUEST_COMMON },
    defaultSubject: "Your bill from {{propertyName}} — {{reference}}",
    defaultBody: `Dear {{guestName}},

Please find your bill for reference {{reference}} attached.

Stay: {{checkIn}} to {{checkOut}}
Total: {{total}}

If you have any questions about the charges, reply to this email and we will look into it.

Kind regards,
{{propertyName}}`,
  },
  {
    key: "reservation_delivery",
    label: "New booking (to the hotel)",
    description: "Internal — a channel booking emailed to the hotel when they run no CRS or PMS.",
    audience: "staff",
    canDisable: true,
    variables: { propertyName: "Hotel Sofia", channelName: "Booking.com", bookings: "• Elena Petrova — Deluxe Double · 14 Aug → 17 Aug" },
    defaultSubject: "New booking(s) — {{propertyName}}",
    defaultBody: `New booking(s) pulled from {{channelName}}:

{{bookings}}`,
  },
  {
    key: "arrival_digest",
    label: "Daily arrivals (to the hotel)",
    description: "Internal — today's/tomorrow's arrivals list at the hotel's chosen time.",
    audience: "staff",
    canDisable: true,
    variables: { propertyName: "Hotel Sofia", label: "Today's arrivals", day: "2026-08-14", arrivals: "• Elena Petrova — Deluxe Double · 3n · Booking.com" },
    defaultSubject: "{{label}} — {{propertyName}} · {{day}}",
    defaultBody: `{{label}} for {{propertyName}}:

{{arrivals}}`,
  },
];

export const EMAIL_TEMPLATE_BY_KEY: Record<string, EmailTemplateDef> = Object.fromEntries(
  EMAIL_TEMPLATES.map((t) => [t.key, t]),
);

/** Per-property branding applied at render time. Every field is optional — sensible fallbacks apply. */
export interface EmailBrand {
  propertyName: string;
  senderName?: string | null;
  replyTo?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  footerText?: string | null;
}

const DEFAULT_BRAND_COLOR = "#0E7C86";

/** Replace {{placeholders}}. Unknown placeholders are left visible rather than silently blanked, so a
 * typo in a hotel's template is obvious in the preview instead of shipping an empty sentence. */
export function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : whole,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  fromName: string;
  replyTo?: string;
}

/**
 * Render a template into the final email. Produces BOTH plain text (what a hotel wrote) and a branded
 * HTML version — sending both is what keeps mail out of spam filters and readable everywhere.
 */
export function renderEmail(args: {
  subject: string;
  body: string;
  brand: EmailBrand;
  vars: Record<string, string>;
}): RenderedEmail {
  const vars = { propertyName: args.brand.propertyName, ...args.vars };
  const subject = fillPlaceholders(args.subject, vars);
  const text = fillPlaceholders(args.body, vars);
  const color = args.brand.brandColor?.trim() || DEFAULT_BRAND_COLOR;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const logo = args.brand.logoUrl
    ? `<img src="${escapeHtml(args.brand.logoUrl)}" alt="${escapeHtml(args.brand.propertyName)}" style="max-height:48px;max-width:200px;display:block">`
    : `<div style="font-size:19px;font-weight:700;color:${escapeHtml(color)}">${escapeHtml(args.brand.propertyName)}</div>`;

  const footer = args.brand.footerText
    ? `<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5">${escapeHtml(args.brand.footerText).replace(/\n/g, "<br>")}</p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="padding:24px 28px;border-bottom:3px solid ${escapeHtml(color)}">${logo}</td></tr>
<tr><td style="padding:28px;font-size:15px">${paragraphs}</td></tr>
${footer ? `<tr><td style="padding:18px 28px;background:#fafbfc;border-top:1px solid #e5e7eb">${footer}</td></tr>` : ""}
</table></body></html>`;

  return {
    subject,
    text,
    html,
    fromName: args.brand.senderName?.trim() || args.brand.propertyName,
    ...(args.brand.replyTo ? { replyTo: args.brand.replyTo } : {}),
  };
}
