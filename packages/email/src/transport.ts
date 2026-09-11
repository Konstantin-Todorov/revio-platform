/**
 * Outbound email — the same adapter pattern as connectivity (mock-first, real provider behind an
 * env key). With RESEND_API_KEY set, mail goes out through Resend; without it, sends are logged
 * and reported as mode "mock" so the demo and tests never depend on an external service.
 *
 * Shared because THREE products send guest mail and an app may never import another app's
 * internals (root CLAUDE.md): RevioLink delivers channel bookings and arrival summaries, RevioDirect
 * confirms a guest's own booking, and the PMS mails a folio. One transport means one place where a
 * missing key degrades to a log instead of an exception.
 */

export interface EmailResult {
  ok: boolean;
  mode: "resend" | "mock";
  error?: string;
  /**
   * The provider never answered inside `EMAIL_TIMEOUT_MS`.
   *
   * Distinct from a plain failure because it means something different to the caller: a rejected
   * send is settled (Resend said no), while a timeout leaves us genuinely not knowing whether the
   * message went out. `trial-sweep.ts` already draws that line for reminders — an unreachable
   * provider must not consume a "we warned them" flag — and it can only draw it if the transport
   * reports it.
   */
  timedOut?: boolean;
}

/**
 * How long any one send may hold the caller.
 *
 * ⚠️ This existed as `Infinity` and that is a user-facing defect, not a tuning choice. `fetch` has
 * no default timeout, so a provider that accepted the connection and then stalled held the request
 * open for as long as it liked — and several of these sends happen INSIDE a server action a person
 * is waiting on. The operator's "Start a trial" button is the reported case: the trial was granted,
 * the transaction committed, and then the screen sat there with no spinner and no message while
 * this fetch waited, which reads as a dead button. The founder pressed it, saw nothing happen, and
 * reloaded — 2026-09-11.
 *
 * Ten seconds is long enough for a slow-but-working API call and short enough that a person has not
 * yet concluded the software is broken. Anything that must not block a person at all should not be
 * awaiting mail in the first place.
 */
const EMAIL_TIMEOUT_MS = 10_000;

/**
 * The From header. A hotel sends as ITS OWN name, from OUR verified address — we can DKIM-sign
 * `reviosoft.app` but never the hotel's own domain, so `"Hotel Sofia <notifications@reviosoft.app>"`
 * (with the hotel's real address in Reply-To) is the deliverable, honest form; sending literally
 * "from" the hotel's domain would fail SPF/DKIM and land in spam. `EMAIL_FROM` stays the platform
 * default and supplies the address; with no hotel name it is used whole, so a password-reset or an
 * operator invite still reads "Revio".
 */
function resolveFrom(fromName?: string | null): string {
  const base = process.env.EMAIL_FROM ?? "Revio <onboarding@resend.dev>";
  const name = fromName?.trim();
  if (!name) return base;
  // Reuse the <address> from EMAIL_FROM; if it is a bare address, that is the address.
  const address = base.match(/<([^>]+)>/)?.[1] ?? base.trim();
  // A hotel controls its own display name, so strip anything that could break the header or smuggle
  // a second address into it (angle brackets, quotes, CR/LF). Header injection, not paranoia.
  const safeName = name.replace(/[<>"\r\n]/g, "").trim() || "Revio";
  return `${safeName} <${address}>`;
}

export async function sendEmail({ to, subject, text, html, fromName, replyTo, attachments }: {
  to: string[];
  subject: string;
  text: string;
  /**
   * The branded HTML alternative. When present it is sent as the HTML part alongside `text`, which
   * stays as the plain-text fallback — a multipart message, best for both deliverability and
   * accessibility. Omitting it (auth codes, staff notes) sends a correct text-only email as before.
   * Guest-facing templated mail passes `renderEmail(...).html`; without this the entire branded
   * design (logo, theme, colour, detail panel) was computed and then dropped, so every confirmation
   * reached the guest as plain text.
   */
  html?: string | null;
  /** The hotel's own sender name — becomes the From display name over our verified address. */
  fromName?: string | null;
  /** The hotel's own address — replies reach them, though the mail is DKIM-signed by us. */
  replyTo?: string | null;
  /**
   * Files to send with the message.
   *
   * Added for the invoice emails: a customer who is asked to pay needs the document itself, and the
   * invoice lives behind the operator login where they will never reach it. Attaching it is what
   * makes the mail self-contained — no public invoice URL had to be invented, which would have been
   * a new unauthenticated surface exposing one customer's billing to anyone who guessed an id.
   *
   * `content` is the raw UTF-8 body; the transport base64-encodes it. Kept small on purpose — this
   * is for a ~12KB HTML invoice, not for photographs.
   */
  attachments?: { filename: string; content: string }[] | null;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:mock] from="${resolveFrom(fromName)}" replyTo=${replyTo ?? "-"} to=${to.join(",")} subject="${subject}" html=${html?.trim() ? "yes" : "no"} attachments=${attachments?.length ?? 0}\n${text}`);
    return { ok: true, mode: "mock" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      // A bounded wait. Without it one stalled provider connection is an unbounded page hang.
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: resolveFrom(fromName),
        to,
        subject,
        text,
        ...(html?.trim() ? { html } : {}),
        ...(replyTo?.trim() ? { reply_to: replyTo.trim() } : {}),
        // Resend takes base64. Encoding here rather than at the call site keeps every caller passing
        // ordinary text and keeps the one place that knows the wire format the one that produces it.
        ...(attachments?.length
          ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, "utf8").toString("base64") })) }
          : {}),
      }),
    });
    if (!res.ok) return { ok: false, mode: "resend", error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, mode: "resend" };
  } catch (err) {
    /*
     * `AbortSignal.timeout` rejects with a DOMException named "TimeoutError". Reported as its own
     * outcome so a caller can tell "Resend refused this message" from "we never heard back".
     */
    const timedOut = (err as Error)?.name === "TimeoutError";
    return {
      ok: false,
      mode: "resend",
      error: timedOut ? `No answer from Resend within ${EMAIL_TIMEOUT_MS / 1000}s` : (err as Error).message,
      ...(timedOut ? { timedOut: true } : {}),
    };
  }
}

/** Resolve a property's delivery recipients from its primary/secondary settings. */
export function deliveryRecipients(
  property: { reservationEmailPrimary: string | null; reservationEmailSecondary: string | null },
  which: "primary" | "secondary" | "both",
): string[] {
  const out: string[] = [];
  if ((which === "primary" || which === "both") && property.reservationEmailPrimary) out.push(property.reservationEmailPrimary);
  if ((which === "secondary" || which === "both") && property.reservationEmailSecondary) out.push(property.reservationEmailSecondary);
  return out;
}
