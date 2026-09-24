import "server-only";
import { sendTemplatedEmail } from "@revio/email";
import { bookingReference } from "@revio/booking";
import { stayDetails } from "@revio/core";
import { setFlash } from "@revio/ui/flash";
import { prisma } from "./db";
import { i18n } from "./i18n/server";
import { reservations as reservationsDict } from "./i18n/reservations";

export type StayEmailKey = "booking_confirmation" | "booking_modified" | "booking_cancelled";
export type StayEmailOutcome = "sent" | "switched-off" | "no-address" | "channel" | "failed";

/**
 * Tell the guest what just happened to their reservation — confirmed, changed or cancelled — in the
 * hotel's own wording, branding and language (RevioCRS → Settings → Guest emails).
 *
 * Until now a reservation typed into RevioCRS sent the guest nothing at all: only a booking made on
 * the booking page was confirmed. The editor meanwhile offered "Booking modified" and "Booking
 * cancelled" for a hotel to write, and nothing ever sent them.
 *
 * ⚠️ Never for a channel booking. Booking.com and Expedia mail their own guest, and a second
 * confirmation from the hotel for the same stay reads as a duplicate booking.
 *
 * Never throws and never blocks: the reservation is already saved, and a mail provider having a bad
 * minute must not turn that into an error page. The outcome is returned so the screen can say it.
 */
export async function emailGuestAbout(reservationId: string, key: StayEmailKey): Promise<StayEmailOutcome> {
  try {
    const r = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, lines: { include: { roomType: true } }, property: true },
    });
    if (!r) return "failed";
    if (r.channelId) return "channel";
    const to = r.guest?.email?.trim();
    if (!to) return "no-address";
    const line = r.lines[0];
    if (!line) return "failed";

    const locale = r.property.defaultLanguage || "en";
    const reference = bookingReference(r.id);
    const checkIn = line.checkIn.toISOString().slice(0, 10);
    const checkOut = line.checkOut.toISOString().slice(0, 10);
    const res = await sendTemplatedEmail(prisma, {
      propertyId: r.propertyId,
      key,
      to: [to],
      locale,
      vars: {
        guestName: r.guest?.firstName || r.guestName,
        propertyName: r.property.name,
        reference,
        checkIn,
        checkOut,
        roomType: line.roomType.name,
        checkInTime: r.property.checkInTime,
      },
      details: stayDetails({
        locale,
        reference,
        roomType: line.roomType.name,
        checkIn,
        checkOut,
        checkInTime: r.property.checkInTime,
        checkOutTime: r.property.checkOutTime,
        guests: line.guestsCount ?? null,
        // A cancellation states no total: there is nothing left to pay, and a figure there reads as a charge.
        ...(key === "booking_cancelled" ? {} : { totalMinor: r.totalMinor, currency: r.currency }),
      }),
    });
    if (res.skipped) return "switched-off";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Say what happened to the guest's email, after the change itself. Never silent: "did they get it?"
 * is the question the front desk is asked next, and a screen that does not say invites a resend.
 */
export async function flashMailOutcome(done: "confirmed" | "modified" | "cancelled", outcome: StayEmailOutcome | null): Promise<void> {
  const m = (await i18n()).t(reservationsDict).mail;
  const d = m[done];
  if (outcome === null) return setFlash("success", m.none(d));
  switch (outcome) {
    case "sent":
      return setFlash("success", m.sent(d));
    case "no-address":
      return setFlash("info", m.noAddress(d));
    case "channel":
      return setFlash("success", m.channel(d));
    case "switched-off":
      return setFlash("info", m.switchedOff(d));
    case "failed":
      return setFlash("error", m.failed(d));
  }
}
