/**
 * The branded shell for SYSTEM email — invitations, password resets, operational notices.
 *
 * ## What this changes, and what it deliberately does not
 *
 * `auth-emails.ts` says plain text is on purpose, for two stated reasons: these must survive every
 * client, and a password-reset mail is the last place to be loading remote images. Both are right,
 * and both are kept:
 *
 *  - **The plain-text part stays.** `sendEmail` is multipart, so the text a client cannot render
 *    HTML for is the same text it received before. Nothing is lost by adding an HTML alternative.
 *  - **There are no remote images. None.** The wordmark is TEXT in a coloured table cell, not a
 *    hosted logo. So there is nothing to load, nothing to block, nothing that leaks a read receipt,
 *    and the mail looks identical whether or not the client blocks images — which is the property
 *    that made plain text attractive in the first place.
 *
 * What was wrong with plain text is the thing it was trying to protect: an unbranded wall of text
 * carrying a link that asks for a password is exactly what a phishing mail looks like. Staff are
 * trained to distrust it, and they are right to. Looking like the product it comes from is a
 * security property, not decoration.
 *
 * ## Email HTML, not web HTML
 *
 * Tables, inline styles, no flexbox, no external stylesheet, no `<style>` block relied upon. Outlook
 * renders through Word and will ignore most of what modern CSS assumes. The layout here is the
 * boring subset that works everywhere.
 */

/** The navy the brand marks are drawn in. Fixed by the artwork, not chosen here. */
const NAVY = "#0e203c";
const LINK = "#1d4ea0";
const INK = "#1c2733";
const MUTED = "#67707e";
const HAIRLINE = "#e3e7ed";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * A URL safe to put in an href.
 *
 * Only http(s) survives. An invitation link is attacker-influenced in the sense that it is built
 * from configuration, and `javascript:` in an href is the one mistake in an email template that
 * turns a mail into an exploit in the clients that still honour it.
 */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? esc(trimmed) : null;
}

export interface SystemEmailBlock {
  /** A paragraph of body copy. */
  p?: string;
  /** A call-to-action. Rendered as a button AND as the bare URL beneath it. */
  action?: { label: string; url: string };
  /** A quiet aside — expiry windows, "if you didn't expect this". */
  note?: string;
  /** A list of short lines: arrivals, new bookings. Rendered as rows, not as a <ul>. */
  list?: readonly string[];
}

export interface SystemEmailArgs {
  /** Preheader: the grey line a client shows next to the subject. */
  preview: string;
  /** The heading at the top of the card. */
  heading: string;
  blocks: readonly SystemEmailBlock[];
  /** Which product this concerns, shown under the wordmark. Omit for platform-wide mail. */
  product?: string;
}

/**
 * Render the branded HTML part.
 *
 * The action is rendered twice on purpose: as a button, and as the full URL in plain text below it.
 * Corporate mail gateways rewrite, wrap and sometimes strip buttons; a URL a person can select and
 * paste is the version that always works. It also lets somebody SEE where the link goes before they
 * click it, which is the single most useful anti-phishing affordance an email can offer.
 */
export function renderSystemEmail(args: SystemEmailArgs): string {
  const body = args.blocks.map((b) => {
    if (b.p) {
      return `<tr><td style="padding:0 0 16px;font-size:15px;line-height:1.6;color:${INK}">${esc(b.p)}</td></tr>`;
    }
    if (b.note) {
      return `<tr><td style="padding:0 0 14px;font-size:13px;line-height:1.6;color:${MUTED}">${esc(b.note)}</td></tr>`;
    }
    if (b.list) {
      if (b.list.length === 0) return "";
      // Rows in a table rather than a <ul>: Outlook's list rendering is unreliable and its bullet
      // indentation is not, which makes a long guest name wrap under the bullet instead of past it.
      const rows = b.list.map((line, i) =>
        `<tr><td style="padding:${i === 0 ? "0" : "7px"} 0 7px;border-top:${i === 0 ? "0" : `1px solid ${HAIRLINE}`};font-size:14px;line-height:1.5;color:${INK}">${esc(line)}</td></tr>`,
      ).join("");
      return `<tr><td style="padding:2px 0 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f9fc;border-radius:8px;padding:14px 16px">${rows}</table>
</td></tr>`;
    }
    if (b.action) {
      const href = safeUrl(b.action.url);
      if (!href) {
        // Refuse to render a link we cannot vouch for, rather than emitting a dead or dangerous one.
        return `<tr><td style="padding:0 0 16px;font-size:15px;color:${INK}">${esc(b.action.url)}</td></tr>`;
      }
      return `<tr><td style="padding:6px 0 20px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${LINK}" style="border-radius:6px">
<a href="${href}" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px">${esc(b.action.label)}</a>
</td></tr></table>
<div style="padding-top:14px;font-size:12.5px;line-height:1.5;color:${MUTED}">Or paste this into your browser:<br>
<span style="color:${LINK};word-break:break-all">${href}</span></div>
</td></tr>`;
    }
    return "";
  }).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(args.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(args.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f9">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

<tr><td style="background:${NAVY};padding:22px 32px">
<!-- The wordmark is TEXT. No hosted image: nothing to block, nothing to load, and no read receipt
     leaked from a password-reset mail. -->
<div style="font-size:19px;font-weight:700;letter-spacing:-.01em;color:#ffffff">Revio</div>
${args.product ? `<div style="padding-top:2px;font-size:12px;color:#9fb2cc">${esc(args.product)}</div>` : ""}
</td></tr>

<tr><td style="padding:30px 32px 8px">
<h1 style="margin:0 0 18px;font-size:19px;line-height:1.35;font-weight:700;color:${INK}">${esc(args.heading)}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
</td></tr>

<tr><td style="padding:6px 32px 26px">
<div style="border-top:1px solid ${HAIRLINE};padding-top:16px;font-size:12px;line-height:1.6;color:${MUTED}">
${/*
   * One line, and no "if you weren't expecting this".
   *
   * The footer used to carry that reassurance too, and it read twice in every invitation — once in
   * the body where it is specific ("no account is active until the link above is used") and again
   * here in a vaguer form. Each email states its own version where it can be precise; the reset says
   * the password has not changed, and the password-CHANGED mail deliberately reassures nobody,
   * because its whole job is to alarm you if it was not you.
   */""}Sent by Revio, the software your property runs on.
</div>
</td></tr>

</table></td></tr></table></body></html>`;
}

/**
 * The plain-text twin.
 *
 * Generated from the SAME blocks as the HTML rather than written separately, because two hand-kept
 * versions of one message drift, and the one that drifts is the one nobody looks at.
 */
export function renderSystemEmailText(args: SystemEmailArgs): string {
  const parts = [args.heading, ""];
  for (const b of args.blocks) {
    if (b.p) parts.push(b.p, "");
    else if (b.note) parts.push(b.note, "");
    else if (b.list) { for (const l of b.list) parts.push(`• ${l}`); parts.push(""); }
    else if (b.action) parts.push(`${b.action.label}:`, b.action.url, "");
  }
  parts.push(`— ${args.product ?? "Revio"}`);
  return parts.join("\n");
}
