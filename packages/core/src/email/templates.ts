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
    // Second person: the hotel reading this list IS the hotel. It used to describe them in the
    // third person and name the products they do not have.
    description: "Sent to you the moment a booking arrives from one of your channels.",
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
    description: "Your arrivals list, sent at the time you choose.",
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
  /** Visual identity of the email itself — see EMAIL_THEMES. */
  theme?: string | null;
  font?: string | null;
}

/** Four genuinely different layouts, so two Revio hotels never send identical-looking mail. Each is a
 * complete visual treatment — masthead, rules, detail panel and spacing all change, not just a colour. */
export const EMAIL_THEMES = [
  { key: "classic", label: "Classic", blurb: "Serif masthead, hairline rules, centred. Traditional luxury." },
  { key: "modern", label: "Modern", blurb: "Solid colour banner, bold left-aligned type, tinted detail block." },
  { key: "minimal", label: "Minimal", blurb: "No frame, no rules. Wide margins and quiet type." },
  { key: "boutique", label: "Boutique", blurb: "Letter-spaced small caps, framed panel, editorial feel." },
] as const;

export const EMAIL_FONTS = [
  { key: "serif", label: "Serif", stack: "Georgia,'Times New Roman',serif" },
  { key: "sans", label: "Sans", stack: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  { key: "mixed", label: "Serif headings, sans body", stack: "Georgia,'Times New Roman',serif" },
] as const;

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
  cta?: { label: string; url: string } | null;
  preheader?: string;
}): RenderedEmail {
  const vars = { propertyName: args.brand.propertyName, ...args.vars };
  const subject = fillPlaceholders(args.subject, vars);
  const color = args.brand.brandColor?.trim() || DEFAULT_BRAND_COLOR;
  const details = args.details ?? [];
  const theme = (args.brand.theme || "classic") as "classic" | "modern" | "minimal" | "boutique";
  const fontKey = (args.brand.font || "serif") as "serif" | "sans" | "mixed";

  const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const SERIF = "Georgia,'Times New Roman',serif";

  /**
   * Three roles, so the hotel's choice reaches everything a guest actually reads.
   *
   * An earlier version resolved these two correctly and then hardcoded SANS into ten of the sixteen
   * font declarations — the detail table, the button, the footer. Picking "Serif" produced a serif
   * masthead on an otherwise sans email, which reads as a broken setting rather than a style.
   *
   * `labelFont` is the deliberate exception: the small uppercase letterspaced labels stay sans in
   * every theme, because Georgia at 10.5px with 0.14em tracking is genuinely harder to read. That is
   * a typographic decision, not an oversight.
   */
  const displayFont = fontKey === "sans" ? SANS : SERIF;
  const bodyFont = fontKey === "serif" ? SERIF : SANS;
  const labelFont = SANS;

  // ---- plain text (identical across themes — the words are the words) -------
  const textDetails = details.length ? details.map((d) => `${d.label}: ${d.value}`).join("\n") : "";
  let text = fillPlaceholders(args.body, vars);
  text = text.includes("{{details}}")
    ? text.replace(/\{\{details\}\}/g, textDetails)
    : textDetails
      ? `${text}\n\n${textDetails}`
      : text;
  if (args.cta) text += `\n\n${args.cta.label}: ${args.cta.url}`;
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // ---- per-theme visual treatment -----------------------------------------
  const T = {
    classic: {
      pageBg: "#F4F5F7", cardBg: "#FFFFFF", cardBorder: "1px solid #E7E9ED", radius: "0",
      pad: "40px", topRule: `<tr><td style="height:3px;background:${color};font-size:0;line-height:0">&nbsp;</td></tr>`,
      mastheadAlign: "center", detailStyle: "rules", labelTransform: "uppercase", labelSpacing: ".06em",
    },
    modern: {
      pageBg: "#EEF1F4", cardBg: "#FFFFFF", cardBorder: "none", radius: "10px",
      pad: "36px", topRule: "", mastheadAlign: "left", detailStyle: "block",
      labelTransform: "none", labelSpacing: "0",
    },
    minimal: {
      pageBg: "#FFFFFF", cardBg: "#FFFFFF", cardBorder: "none", radius: "0",
      pad: "48px", topRule: "", mastheadAlign: "left", detailStyle: "plain",
      labelTransform: "none", labelSpacing: "0",
    },
    boutique: {
      pageBg: "#F7F5F2", cardBg: "#FFFFFF", cardBorder: "1px solid #E3DED6", radius: "0",
      pad: "44px", topRule: "", mastheadAlign: "center", detailStyle: "framed",
      labelTransform: "uppercase", labelSpacing: ".14em",
    },
  }[theme];

  // Detail panel — a different object in each theme, not the same table recoloured.
  const detailPanel = !details.length
    ? ""
    : T.detailStyle === "block"
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0;background:#F6F8FA;border-radius:8px">
<tr><td style="padding:20px 22px">
${details.map((d) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="padding:6px 0;font-size:13px;color:#67707E;font-family:${bodyFont}">${escapeHtml(d.label)}</td>
<td style="padding:6px 0;text-align:right;font-size:${d.emphasis ? "17px" : "14px"};font-weight:${d.emphasis ? "700" : "600"};color:${d.emphasis ? color : "#1A2230"};font-family:${d.emphasis ? displayFont : bodyFont}">${escapeHtml(d.value)}</td>
</tr></table>`).join("")}
</td></tr></table>`
      : T.detailStyle === "framed"
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;border:1px solid ${color}33">
<tr><td style="padding:24px 26px">
${details.map((d, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="padding:${i === 0 ? "0" : "10px"} 0 10px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#9A8F7F;font-family:${labelFont}">${escapeHtml(d.label)}</td>
<td style="padding:${i === 0 ? "0" : "10px"} 0 10px;text-align:right;font-size:${d.emphasis ? "18px" : "15px"};color:${d.emphasis ? color : "#2A2520"};font-family:${displayFont}">${escapeHtml(d.value)}</td>
</tr></table>`).join("")}
</td></tr></table>`
        : T.detailStyle === "plain"
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0">
${details.map((d) => `<tr>
<td style="padding:5px 16px 5px 0;font-size:14px;color:#8C939E;font-family:${bodyFont};white-space:nowrap">${escapeHtml(d.label)}</td>
<td style="padding:5px 0;font-size:${d.emphasis ? "16px" : "14px"};color:${d.emphasis ? color : "#20262F"};font-weight:${d.emphasis ? "600" : "400"};font-family:${d.emphasis ? displayFont : bodyFont}">${escapeHtml(d.value)}</td>
</tr>`).join("")}
</table>`
          : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;border-collapse:collapse">
${details.map((d, i) => `<tr>
<td style="padding:${i === 0 ? "0" : "11px"} 16px 11px 0;${i === 0 ? "" : "border-top:1px solid #ECEEF1;"}font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8A93A0;white-space:nowrap;vertical-align:top;font-family:${labelFont}">${escapeHtml(d.label)}</td>
<td style="padding:${i === 0 ? "0" : "11px"} 0 11px 0;${i === 0 ? "" : "border-top:1px solid #ECEEF1;"}font-size:${d.emphasis ? "17px" : "15px"};${d.emphasis ? `font-weight:700;color:${color};` : "color:#1A2230;"}text-align:right;vertical-align:top;font-family:${d.emphasis ? displayFont : bodyFont}">${escapeHtml(d.value)}</td>
</tr>`).join("")}
</table>`;

  const bodyFilled = fillPlaceholders(args.body, vars);
  const hasMarker = bodyFilled.includes("{{details}}");
  const htmlBody = (hasMarker ? bodyFilled : bodyFilled + (detailPanel ? "\n\n{{details}}" : ""))
    .split(/\n{2,}/)
    .map((block) => {
      if (block.trim() === "{{details}}") return detailPanel;
      const safe = escapeHtml(block.trim()).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 18px;font-size:15.5px;line-height:1.7;color:#313B4A;font-family:${bodyFont}">${safe}</p>`;
    })
    .join("\n");

  const ctaBlock = args.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 26px${T.mastheadAlign === "center" ? ";margin-left:auto;margin-right:auto" : ""}">
<tr><td style="background:${color};border-radius:${theme === "modern" ? "6px" : "2px"}">
<a href="${escapeHtml(args.cta.url)}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:.02em;font-family:${bodyFont}">${escapeHtml(args.cta.label)}</a>
</td></tr></table>`
    : "";

  const nameStyle =
    theme === "boutique"
      ? `font-family:${displayFont};font-size:20px;letter-spacing:.22em;text-transform:uppercase;color:#2A2520`
      : theme === "modern"
        ? `font-family:${displayFont};font-size:22px;font-weight:700;color:#FFFFFF`
        : theme === "minimal"
          ? `font-family:${displayFont};font-size:19px;color:#20262F`
          : `font-family:${displayFont};font-size:25px;letter-spacing:.02em;color:#1A2230`;

  const masthead = args.brand.logoUrl
    ? `<img src="${escapeHtml(args.brand.logoUrl)}" alt="${escapeHtml(args.brand.propertyName)}" style="max-height:56px;max-width:220px;display:block${T.mastheadAlign === "center" ? ";margin:0 auto" : ""}">`
    : `<div style="${nameStyle};text-align:${T.mastheadAlign}">${escapeHtml(args.brand.propertyName)}</div>`;

  // Modern puts the masthead in a solid colour banner; the others sit on the card.
  const mastheadRow =
    theme === "modern"
      ? `<tr><td style="padding:26px ${T.pad};background:${color}">${masthead}</td></tr>`
      : `<tr><td style="padding:${theme === "minimal" ? "8px" : "34px"} ${T.pad} 22px">${masthead}</td></tr>`;

  const footer = args.brand.footerText
    ? `<tr><td style="padding:20px ${T.pad} 30px;text-align:${T.mastheadAlign}">
<div style="height:1px;background:${theme === "boutique" ? "#E3DED6" : "#ECEEF1"};margin:0 0 16px"></div>
<p style="margin:0;color:#8A93A0;font-size:12px;line-height:1.65;font-family:${bodyFont}">${escapeHtml(args.brand.footerText).replace(/\n/g, "<br>")}</p>
</td></tr>`
    : "";

  const pre = args.preheader ? fillPlaceholders(args.preheader, vars) : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${T.pageBg};-webkit-font-smoothing:antialiased">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(pre)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.pageBg}">
<tr><td align="center" style="padding:${theme === "minimal" ? "48px" : "36px"} 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${theme === "minimal" ? "520px" : "580px"};background:${T.cardBg};border:${T.cardBorder};border-radius:${T.radius};overflow:hidden">
    ${T.topRule}
    ${mastheadRow}
    <tr><td style="padding:0 ${T.pad}">
      ${htmlBody}
      ${ctaBlock}
    </td></tr>
    ${footer}
  </table>
  <p style="margin:16px 0 0;font-size:11px;color:#A3AAB5;font-family:${SANS}">Sent by ${escapeHtml(args.brand.propertyName)}</p>
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

// --- Languages -------------------------------------------------------------
//
// Guest-facing mail is written per language. Bulgarian is a first-class language, not a machine
// translation of the English: the register is the formal "Вие" a Bulgarian hotel actually uses with
// guests. Adding a language = adding an entry here; the themes and renderer need no changes.

export const EMAIL_LOCALES = [
  { key: "en", label: "English" },
  { key: "bg", label: "Български" },
] as const;

export type EmailLocale = (typeof EMAIL_LOCALES)[number]["key"];

/** Labels for the standard reservation detail rows, per language. Callers pass these so the detail
 * panel is localised together with the prose — an English "ARRIVAL" above Bulgarian text looks broken. */
export const DETAIL_LABELS: Record<string, Record<string, string>> = {
  en: { reference: "Reference", arrival: "Arrival", departure: "Departure", accommodation: "Accommodation", total: "Total" },
  bg: { reference: "Номер", arrival: "Настаняване", departure: "Напускане", accommodation: "Настаняване в", total: "Общо" },
};

/** Per-language default wording. English lives on the template definition itself; other languages here.
 * A language with no entry for a template falls back to English rather than sending nothing. */
export const EMAIL_TRANSLATIONS: Record<string, Record<string, { subject: string; body: string }>> = {
  bg: {
    booking_confirmation: {
      subject: "Потвърждение на резервацията Ви в {{propertyName}} — {{reference}}",
      body: `Уважаеми {{guestName}},

Благодарим Ви, че избрахте {{propertyName}}. Вашата резервация е потвърдена и вече очакваме с
нетърпение да Ви посрещнем.

{{details}}

Ако желаете да уредите нещо преди пристигането си — ранно настаняване, трансфер или специален
повод — просто отговорете на това съобщение и ще се погрижим.

С уважение,
{{propertyName}}`,
    },
    booking_modified: {
      subject: "Вашата резервация е обновена — {{reference}}",
      body: `Уважаеми {{guestName}},

Вашата резервация при нас беше обновена. Ето актуалните данни:

{{details}}

Ако нещо по-горе не изглежда правилно, отговорете на това съобщение и ще го коригираме веднага.

С уважение,
{{propertyName}}`,
    },
    booking_cancelled: {
      subject: "Вашата резервация е анулирана — {{reference}}",
      body: `Уважаеми {{guestName}},

Пишем Ви, за да потвърдим, че Вашата резервация беше анулирана.

{{details}}

Ако това не е било Вашето намерение, моля свържете се с нас възможно най-скоро и ще направим
всичко възможно да я възстановим. Надяваме се да Ви посрещнем друг път.

С уважение,
{{propertyName}}`,
    },
    pre_arrival: {
      subject: "Очакваме Ви в {{propertyName}}",
      body: `Уважаеми {{guestName}},

Очакваме с нетърпение да Ви посрещнем съвсем скоро. Настаняването започва от {{checkInTime}} ч.

{{details}}

Ако желаете да уредите ранно пристигане, трансфер от летището или нещо специално за повода, просто
отговорете и с радост ще помогнем.

До скоро,
{{propertyName}}`,
    },
    post_stay: {
      subject: "Благодарим Ви за престоя в {{propertyName}}",
      body: `Уважаеми {{guestName}},

Благодарим Ви, че отседнахте при нас. Надяваме се да сте прекарали приятно време в {{propertyName}}.

Ако разполагате с момент, ще се радваме на Вашето мнение — а ако резервирате директно при нас
следващия път, винаги ще се постараем да се погрижим за Вас.

Приятен път,
{{propertyName}}`,
    },
    folio_receipt: {
      subject: "Вашата сметка от {{propertyName}} — {{reference}}",
      body: `Уважаеми {{guestName}},

Благодарим Ви, че отседнахте при нас. По-долу ще намерите обобщение на Вашата сметка.

{{details}}

Ако имате какъвто и да е въпрос относно тези суми, отговорете на това съобщение и ще проверим лично.

С уважение,
{{propertyName}}`,
    },
  },
};

/** The platform default wording for a template in a given language (English if untranslated). */
export function defaultsFor(def: EmailTemplateDef, locale: string): { subject: string; body: string } {
  const t = EMAIL_TRANSLATIONS[locale]?.[def.key];
  return t ?? { subject: def.defaultSubject, body: def.defaultBody };
}

/** Sample details for the Settings preview, localised so the panel matches the prose. */
export function sampleDetails(locale: string): EmailDetail[] {
  const L = DETAIL_LABELS[locale] ?? DETAIL_LABELS.en!;
  return locale === "bg"
    ? [
        { label: L.reference!, value: "RV-10482" },
        { label: L.arrival!, value: "петък, 14 август 2026 — от 14:00 ч." },
        { label: L.departure!, value: "понеделник, 17 август 2026 — до 12:00 ч." },
        { label: L.accommodation!, value: "Двойна стая Делукс · 3 нощувки" },
        { label: L.total!, value: "540,00 €", emphasis: true },
      ]
    : SAMPLE_DETAILS;
}
