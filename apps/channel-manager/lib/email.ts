import "server-only";

/**
 * Outbound email — the same adapter pattern as connectivity (mock-first, real provider behind an
 * env key). With RESEND_API_KEY set, mail goes out through Resend; without it, sends are logged
 * and reported as mode "mock" so the demo and tests never depend on an external service.
 *
 * Used for reservation delivery (channel bookings emailed to the property when no PMS/CRS is
 * connected) and the arrival-summary notifications (CM-UPDATES-V1 Settings).
 */

export interface EmailResult {
  ok: boolean;
  mode: "resend" | "mock";
  error?: string;
}

export async function sendEmail({ to, subject, text }: { to: string[]; subject: string; text: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:mock] to=${to.join(",")} subject="${subject}"\n${text}`);
    return { ok: true, mode: "mock" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Revio <onboarding@resend.dev>",
        to,
        subject,
        text,
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
