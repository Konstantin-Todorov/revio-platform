import "server-only";
import { sendTemplatedEmail } from "@revio/email";
import { DEFAULT_OFFER_TTL_MINUTES } from "@revio/core";
import type { SweepResult } from "@revio/booking";

/**
 * The emails the sweep produced.
 *
 * Sent AFTER the sweep has committed, never inside it. A hold that exists with no email is a room
 * quietly off sale for four hours — recoverable, and the hold job releases it. An email that exists
 * with no hold tells a guest about a room nobody reserved, which is unrecoverable because they have
 * already read it. So the write wins the tie, every time.
 *
 * A provider having a bad minute must not turn a correct sweep into an error either, which is why
 * each send is caught individually rather than the batch being awaited as one.
 *
 * Its own module rather than beside the action that first needed it: a `"use server"` file may
 * only export server actions, and the cron route needs this too — so there were always two
 * callers, one of which could not import it.
 */
export async function sendSweepEmails(
  db: Parameters<typeof sendTemplatedEmail>[0],
  propertyId: string,
  slug: string | null,
  result: SweepResult,
): Promise<void> {
  const origin = process.env.BOOKING_ENGINE_ORIGIN?.trim().replace(/\/+$/, "") ?? "";
  const hours = Math.round(DEFAULT_OFFER_TTL_MINUTES / 60);

  for (const o of result.offers) {
    // No origin configured means no working link, and an offer email whose button goes nowhere is
    // worse than silence — the guest reads a deadline and cannot act on it.
    // No origin, or no public slug, means no working link — and an offer email whose button goes
    // nowhere is worse than silence, because the guest reads a deadline they cannot act on.
    if (!origin || !slug) break;
    await sendTemplatedEmail(db, {
      propertyId,
      key: "waitlist_offer",
      to: [o.guestEmail],
      locale: o.locale,
      vars: {
        guestName: o.guestName,
        offerDeadline: o.expiresAt.toISOString().slice(0, 16).replace("T", " "),
      },
      details: [
        { label: "Dates", value: `${o.checkIn} → ${o.checkOut}`, emphasis: true },
        { label: "Held until", value: o.expiresAt.toISOString().slice(0, 16).replace("T", " ") },
      ],
      cta: { label: "Book this room", url: `${origin}/${slug}/waitlist/${o.claimToken}` },
    }).catch(() => {});
  }

  for (const e of result.lapsedEntries) {
    await sendTemplatedEmail(db, {
      propertyId,
      key: "waitlist_expired",
      to: [e.guestEmail],
      locale: e.locale,
      vars: { guestName: e.guestName, holdWindow: `${hours} hours` },
    }).catch(() => {});
  }
}
