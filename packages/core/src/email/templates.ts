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

Thank you for choosing {{propertyName}}. Your reservation is confirmed, and we are already looking
forward to welcoming you.

{{details}}

Should you wish to arrange anything before you arrive — an early check-in, a transfer, a special
occasion — simply reply to this message and we will take care of it.

With warm regards,
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

Your reservation with us has been updated. Here are your current details:

{{details}}

If anything above does not look right, reply to this message and we will put it straight away.

With warm regards,
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

We are writing to confirm that your reservation has been cancelled.

{{details}}

If this was not what you intended, please contact us as soon as you can and we will do our best to
restore it. We hope to welcome you another time.

With warm regards,
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

We are looking forward to welcoming you very soon. Check-in opens at {{checkInTime}}.

{{details}}

If you would like to arrange an early arrival, a transfer from the airport, or anything to mark a
special occasion, simply reply and we will be delighted to help.

Until soon,
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

Thank you for staying with us. Please find a summary of your account below.

{{details}}

If you have any question at all about these charges, reply to this message and we will look into it
personally.

With warm regards,
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

/** A structured detail row (reference, arrival, room…). Rendered as a refined panel in HTML and as
 * aligned plain text — never as a wall of "Label: value" lines inside the prose. */
export interface EmailDetail {
  label: string;
  value: string;
  /** Renders larger and bolder — use for the one figure that matters (a total, a balance). */
  emphasis?: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  fromName: string;
  replyTo?: string;
}

/** Sample details used by the Settings preview so a hotel sees a realistic email, not a skeleton. */
export const SAMPLE_DETAILS: EmailDetail[] = [
  { label: "Reference", value: "RV-10482" },
  { label: "Arrival", value: "Friday, 14 August 2026 — from 14:00" },
  { label: "Departure", value: "Monday, 17 August 2026 — until 12:00" },
  { label: "Accommodation", value: "Deluxe Double Room · 3 nights" },
  { label: "Total", value: "€540.00", emphasis: true },
];

/**
 * Render a template into the final email — plain text (deliverability + accessibility) and a branded
 * HTML version built for hotel guests.
 *
 * The HTML is deliberately old-school table markup with inline styles: Outlook and older mail clients
 * ignore <div> layouts and external CSS, and a confirmation that renders badly is worse than a plain
 * one. Within that constraint the design aims high — a serif display face for the property name and
 * headings, generous whitespace, a hairline-ruled details panel, and a single restrained accent.
 *
 * `{{details}}` in the body is replaced by the structured panel (HTML) or aligned lines (text). If a
 * hotel deletes the marker, the details are appended after the prose rather than lost.
 */
export function renderEmail(args: {
  subject: string;
  body: string;
  brand: EmailBrand;
  vars: Record<string, string>;
  details?: EmailDetail[];
  /** Optional call to action, e.g. { label: "View your booking", url: "https://…" }. */
  cta?: { label: string; url: string } | null;
  /** One line shown in the inbox preview next to the subject. */
  preheader?: string;
}): RenderedEmail {
  const vars = { propertyName: args.brand.propertyName, ...args.vars };
  const subject = fillPlaceholders(args.subject, vars);
  const color = args.brand.brandColor?.trim() || DEFAULT_BRAND_COLOR;
  const details = args.details ?? [];

  // ---- plain text ----------------------------------------------------------
  const textDetails = details.length
    ? details.map((d) => `${d.label}: ${d.value}`).join("\n")
    : "";
  let text = fillPlaceholders(args.body, vars);
  text = text.includes("{{details}}")
    ? text.replace(/\{\{details\}\}/g, textDetails)
    : textDetails
      ? `${text}\n\n${textDetails}`
      : text;
  if (args.cta) text += `\n\n${args.cta.label}: ${args.cta.url}`;
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // ---- HTML ----------------------------------------------------------------
  const detailPanel = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;border-collapse:collapse">
${details
  .map(
    (d, i) => `<tr>
<td style="padding:${i === 0 ? "0" : "11px"} 16px 11px 0;${i === 0 ? "" : "border-top:1px solid #ECEEF1;"}font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8A93A0;white-space:nowrap;vertical-align:top">${escapeHtml(d.label)}</td>
<td style="padding:${i === 0 ? "0" : "11px"} 0 11px 0;${i === 0 ? "" : "border-top:1px solid #ECEEF1;"}font-size:${d.emphasis ? "17px" : "15px"};${d.emphasis ? `font-weight:700;color:${escapeHtml(color)};` : "color:#1A2230;"}text-align:right;vertical-align:top">${escapeHtml(d.value)}</td>
</tr>`,
  )
  .join("\n")}
</table>`
    : "";

  const bodyFilled = fillPlaceholders(args.body, vars);
  const hasMarker = bodyFilled.includes("{{details}}");
  const htmlBody = (hasMarker ? bodyFilled : bodyFilled + (detailPanel ? "\n\n{{details}}" : ""))
    .split(/\n{2,}/)
    .map((block) => {
      if (block.trim() === "{{details}}") return detailPanel;
      const safe = escapeHtml(block.trim()).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 18px;font-size:15.5px;line-height:1.68;color:#313B4A">${safe}</p>`;
    })
    .join("\n");

  const ctaBlock = args.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 24px">
<tr><td style="background:${escapeHtml(color)};border-radius:3px">
<a href="${escapeHtml(args.cta.url)}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:.02em">${escapeHtml(args.cta.label)}</a>
</td></tr></table>`
    : "";

  const serif = "Georgia,'Times New Roman',serif";
  const masthead = args.brand.logoUrl
    ? `<img src="${escapeHtml(args.brand.logoUrl)}" alt="${escapeHtml(args.brand.propertyName)}" style="max-height:56px;max-width:220px;display:block;margin:0 auto">`
    : `<div style="font-family:${serif};font-size:25px;letter-spacing:.02em;color:#1A2230;text-align:center">${escapeHtml(args.brand.propertyName)}</div>`;

  const footer = args.brand.footerText
    ? `<tr><td style="padding:22px 40px 30px;text-align:center">
<div style="height:1px;background:#ECEEF1;margin:0 0 18px"></div>
<p style="margin:0;color:#8A93A0;font-size:12px;line-height:1.65">${escapeHtml(args.brand.footerText).replace(/\n/g, "<br>")}</p>
</td></tr>`
    : "";

  const pre = args.preheader ? fillPlaceholders(args.preheader, vars) : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F5F7;-webkit-font-smoothing:antialiased">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(pre)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7">
<tr><td align="center" style="padding:36px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border:1px solid #E7E9ED">
    <tr><td style="height:3px;background:${escapeHtml(color)};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:34px 40px 26px">${masthead}</td></tr>
    <tr><td style="padding:0 40px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      ${htmlBody}
      ${ctaBlock}
    </td></tr>
    ${footer}
  </table>
  <p style="margin:16px 0 0;font-size:11px;color:#A3AAB5;font-family:system-ui,sans-serif">Sent by ${escapeHtml(args.brand.propertyName)}</p>
</td></tr>
</table>
</body></html>`;

  return {
    subject,
    text,
    html,
    fromName: args.brand.senderName?.trim() || args.brand.propertyName,
    ...(args.brand.replyTo ? { replyTo: args.brand.replyTo } : {}),
  };
}
