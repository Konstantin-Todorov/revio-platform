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
}

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

export async function sendEmail({ to, subject, text, html, fromName, replyTo }: {
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
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:mock] from="${resolveFrom(fromName)}" replyTo=${replyTo ?? "-"} to=${to.join(",")} subject="${subject}" html=${html?.trim() ? "yes" : "no"}\n${text}`);
    return { ok: true, mode: "mock" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: resolveFrom(fromName),
        to,
        subject,
        text,
        ...(html?.trim() ? { html } : {}),
        ...(replyTo?.trim() ? { reply_to: replyTo.trim() } : {}),
      }),
    });
    if (!res.ok) return { ok: false, mode: "resend", error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, mode: "resend" };
  } catch (err) {
    return { ok: false, mode: "resend", error: (err as Error).message };
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
