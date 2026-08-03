"use server";

import { redirect } from "next/navigation";
import { forTenant } from "@revio/db";
import { bookingReference, publicCreateReservation, publicGetHold, publicReleaseHold } from "@revio/booking";
import { createCardGuarantee } from "@revio/payments";
import { sendTemplatedEmail } from "@revio/email";
import { forSystem } from "@revio/db";
import { getPublicProperty } from "./property";
import { nightsBetween } from "./dates";

/**
 * Confirming a booking.
 *
 * Everything is re-derived server-side. The form carries dates, a room and a rate, but never a
 * price: the quote is recomputed from the same engine the results page used, so a tampered field
 * changes what is booked, never what is charged. That is the whole reason the hidden inputs are
 * identifiers rather than amounts.
 */

export interface BookResult {
  ok: boolean;
  error?: string;
}

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "").trim();

export async function confirmBooking(_prev: BookResult | null, fd: FormData): Promise<BookResult> {
  const slug = str(fd, "slug");
  const property = await getPublicProperty(slug);
  // Same generic answer as everywhere else on this app — never leak whether a hotel exists.
  if (!property) return { ok: false, error: "This booking page isn't available." };

  const db = forTenant(property.tenantId);
  const scoped = { ...property, id: property.id };

  const holdId = str(fd, "holdId");
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const email = str(fd, "email");
  const phone = str(fd, "phone");

  if (!firstName || !lastName) return { ok: false, error: "Please give your first and last name." };
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: "That email address doesn't look right." };
  if (fd.get("acceptTerms") == null) {
    return { ok: false, error: "Please accept the booking conditions to continue." };
  }

  // The hold is the guest's claim on the room. If it expired while they were typing, say so plainly
  // and send them back to a fresh search rather than silently booking something else.
  if (holdId && !(await publicGetHold(db, property.id, holdId))) {
    return {
      ok: false,
      error:
        "Your room was only held for a short time and that window has passed. Please search again — it may still be free.",
    };
  }

  /**
   * The card guarantee — but only when the hotel can actually take one.
   *
   * `paymentReady` mirrors Stripe's `charges_enabled` on the hotel's OWN connected account. Until
   * that is true there is no account to authorise against, so taking a "guarantee" would mean
   * storing a token nobody can ever capture: the front desk would read *card on file* and find
   * nothing behind it on the night a guest failed to arrive. So the engine falls back to
   * **request-to-book** — no card, and the hotel accepts the stay itself.
   *
   * Decided ONCE, here, and passed down. Reading `paymentReady` again further in would risk a
   * booking that tells the guest "confirmed" and the hotel "please review".
   */
  const requestOnly = !property.paymentReady;

  const guarantee = requestOnly
    ? null
    : await createCardGuarantee(
        property.baseCurrency,
        `Guarantee · ${property.name} · ${str(fd, "checkIn")}`,
      );
  if (guarantee && !guarantee.ok) {
    return { ok: false, error: "We couldn't confirm your card guarantee. Please try again, or call the hotel." };
  }

  const result = await publicCreateReservation(db, scoped, {
    checkIn: str(fd, "checkIn"),
    checkOut: str(fd, "checkOut"),
    guests: Number.parseInt(str(fd, "guests") || "2", 10),
    roomTypeId: str(fd, "roomTypeId"),
    ratePlanId: str(fd, "ratePlanId"),
    guest: { firstName, lastName, email, ...(phone ? { phone } : {}) },
    ...(holdId ? { holdId } : {}),
    ...(guarantee ? { guarantee: { ref: guarantee.ref, brand: guarantee.brand, last4: guarantee.last4 } } : {}),
    requestOnly,
    guestNote: str(fd, "note"),
  });

  if (result.error || !result.reservationId) {
    return { ok: false, error: result.error ?? "We couldn't complete that booking." };
  }

  const reference = bookingReference(result.reservationId);

  /**
   * The confirmation. Uses the hotel's OWN template and branding — the same engine RevioLink sends
   * from — so a guest who books direct gets the hotel's mail, not the platform's.
   *
   * Never blocks the booking. The room is already theirs; a mail provider having a bad minute must
   * not turn a completed reservation into an error page, and the reference is on screen either way.
   */
  try {
    await sendTemplatedEmail(forSystem(), {
      propertyId: property.id,
      key: "booking_confirmation",
      to: [email],
      locale: property.defaultLanguage,
      vars: {
        guestName: firstName,
        propertyName: property.name,
        checkIn: str(fd, "checkIn"),
        checkOut: str(fd, "checkOut"),
        nights: String(nightsBetween(str(fd, "checkIn"), str(fd, "checkOut"))),
        roomType: result.roomTypeName ?? "",
        reference,
        total: formatMoney(result.totalMinor ?? 0, result.currency ?? property.baseCurrency),
      },
      // The stay, itemised the same way the confirmation page shows it.
      details: [
        { label: "Reference", value: reference },
        { label: "Room", value: result.roomTypeName ?? "" },
        { label: "Check-in", value: `${str(fd, "checkIn")} from ${property.checkInTime}` },
        { label: "Check-out", value: `${str(fd, "checkOut")} by ${property.checkOutTime}` },
        { label: "Guests", value: str(fd, "guests") || "2" },
        {
          label: "Total to pay at the hotel",
          value: formatMoney(result.totalMinor ?? 0, result.currency ?? property.baseCurrency),
          emphasis: true,
        },
      ],
    });
  } catch {
    /* logged by the transport; the guest already has their confirmation on screen */
  }

  // Outside any try/catch on purpose: `redirect` throws by design in Next, and swallowing it would
  // leave the guest sitting on the form after their booking had already succeeded.
  redirect(`/${property.slug}/booking/${reference}`);
}

/** Abandoning the form. Best-effort — the hold expires on its own if this never runs. */
export async function abandonHold(fd: FormData): Promise<void> {
  const slug = str(fd, "slug");
  const holdId = str(fd, "holdId");
  const property = await getPublicProperty(slug);
  if (!property) return;
  if (holdId) await publicReleaseHold(forTenant(property.tenantId), property.id, holdId);
  redirect(`/${property.slug}`);
}

/** Money for an email body — plain text, so no HTML entities and no locale surprises. */
function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}
