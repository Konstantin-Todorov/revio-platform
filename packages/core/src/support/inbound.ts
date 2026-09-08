/**
 * Reading a reply that arrived by email, and deciding what it is.
 *
 * We send every support reply as email, because nobody logs into a portal to see whether support
 * answered. The consequence is that people hit reply — and until now that answer went to a mailbox
 * and vanished from the system, so the thread both sides were meant to share had a hole in it
 * exactly where the customer spoke.
 *
 * Everything here is pure. The IMAP connection and the database writes live elsewhere; this module
 * only decides what an email *is*, which is the part that has to be right and the part worth testing.
 *
 * ## The three decisions
 *
 * 1. **Which ticket is this?** From the reference we already put in the subject.
 * 2. **What did they actually write?** Not the entire quoted history under it.
 * 3. **Is this a person at all?** An out-of-office filed as a customer reply would reopen the case
 *    and send them another email, which fetches another out-of-office. A mail loop with a customer
 *    is the worst possible bug in this feature, so the auto-reply check comes first and is generous:
 *    a missed genuine reply costs one person one retry, a loop costs the relationship.
 */

/** The marker we put in outgoing support mail so the reply can be separated exactly. */
export const REPLY_MARKER = "--- Please reply above this line ---";

/** `SR-` plus the six characters `supportReference` takes off the end of the id. */
const REFERENCE = /\bSR-([A-Z0-9]{6})\b/i;

/**
 * The ticket this email belongs to, or null.
 *
 * Read from the subject because that is the one thing every mail client carries through a reply
 * unchanged, whatever it does to the body.
 */
export function referenceInSubject(subject: string): string | null {
  const m = REFERENCE.exec(subject ?? "");
  return m ? `SR-${m[1]!.toUpperCase()}` : null;
}

/** The id suffix that reference was built from — what a lookup matches on. */
export function referenceSuffix(reference: string): string {
  return reference.replace(/^SR-/i, "").toLowerCase();
}

/**
 * Was this sent by a machine?
 *
 * Header checks first because they are unambiguous, then a few subject shapes for the servers that
 * do not set them. `Auto-Submitted` is the standard (RFC 3834); `Precedence: bulk` and the
 * `X-Auto*` family are what everything else actually uses.
 */
export function isAutomatedEmail(input: {
  headers?: Record<string, string | undefined>;
  subject?: string;
}): boolean {
  const h = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), (v ?? "").toLowerCase()]),
  );

  const autoSubmitted = h["auto-submitted"];
  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]) return true;
  if (["bulk", "auto_reply", "junk", "list"].includes(h["precedence"] ?? "")) return true;
  // A bounce. Replying to one guarantees another.
  if ((h["from"] ?? "").includes("mailer-daemon") || (h["return-path"] ?? "") === "<>") return true;

  const subject = (input.subject ?? "").toLowerCase();
  return [
    "out of office",
    "out-of-office",
    "automatic reply",
    "auto-reply",
    "autoreply",
    "undeliverable",
    "delivery status notification",
    "mail delivery failed",
  ].some((p) => subject.includes(p));
}

/**
 * What the person actually typed, without the conversation they replied over.
 *
 * The marker is exact and is tried first — we control the outgoing mail, so most replies can be cut
 * on a line we chose. Everything else is heuristics for the mail we sent before the marker existed
 * and for clients that mangle it: the "On … wrote:" attribution, Outlook's original-message rule,
 * and a run of `>` quoting.
 *
 * Erring towards keeping too much: a reply with some history under it is untidy, a reply cut short
 * has lost what the customer said.
 */
export function stripQuotedReply(body: string): string {
  const text = (body ?? "").replace(/\r\n/g, "\n");

  const marker = text.indexOf(REPLY_MARKER);
  if (marker !== -1) return text.slice(0, marker).trim();

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (
      /^-{2,}\s*original message\s*-{2,}$/i.test(line) ||
      /^_{5,}$/.test(line) ||
      /^on .{4,120}\bwrote:$/i.test(line) ||
      /^from:\s.+/i.test(line) ||
      // A quoted block that runs to the end of the message is the history, not an aside.
      (line.startsWith(">") && lines.slice(i).every((l) => !l.trim() || l.trim().startsWith(">")))
    ) {
      return lines.slice(0, i).join("\n").trim();
    }
  }
  return text.trim();
}

/** A bare address out of `Elena <elena@marinabay.test>`, lowercased for comparison. */
export function bareAddress(from: string): string {
  const angled = /<([^>]+)>/.exec(from ?? "");
  return (angled ? angled[1]! : (from ?? "")).trim().toLowerCase();
}

export type InboundDecision =
  | { action: "reply"; reference: string; body: string }
  | { action: "new"; body: string }
  | { action: "ignore"; reason: "automated" | "empty" };

/**
 * What to do with one email, given only the email itself.
 *
 * Deliberately knows nothing about who our customers are — matching the sender to an account needs
 * the database and belongs with it. This answers the part that is decidable from the message.
 */
export function decideInbound(input: {
  subject?: string;
  text?: string;
  headers?: Record<string, string | undefined>;
}): InboundDecision {
  if (isAutomatedEmail(input)) return { action: "ignore", reason: "automated" };

  const body = stripQuotedReply(input.text ?? "");
  if (!body) return { action: "ignore", reason: "empty" };

  const reference = referenceInSubject(input.subject ?? "");
  return reference ? { action: "reply", reference, body } : { action: "new", body };
}
