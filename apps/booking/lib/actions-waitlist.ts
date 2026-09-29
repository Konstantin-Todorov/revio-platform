"use server";

import { headers } from "next/headers";
import { forTenant } from "@revio/db";
import { sendTemplatedEmail } from "@revio/email";
import { canJoinWaitlist, DEFAULT_OFFER_TTL_MINUTES } from "@revio/core";
import { clientIp, hit, type RateLimitRule } from "@revio/booking";
import { getPublicProperty } from "./property";
import { serverKit } from "./i18n/server";

/**
 * Joining the waitlist from a sold-out search.
 *
 * ## What is trusted from the form: the dates, and nothing else
 *
 * Same rule as `confirmBooking` — the form carries dates and a party size, and every one is
 * re-validated here against `canJoinWaitlist` using the **property's** today rather than the
 * server's. A stay starting "today" in Sofia is still joinable at 23:00 in London, and the server's
 * midnight is not the hotel's.
 *
 * ## Why this cannot be a guest-enumeration oracle
 *
 * The answer is identical whether or not this email has been here before, and identical whether or
 * not the hotel exists. This is an unauthenticated endpoint on a public page: the K6 decision about
 * returning-guest recognition applies with more force here, because a waitlist is a list of people
 * who want something, and confirming membership would leak that.
 *
 * Re-joining the same dates is therefore silent and idempotent — it updates the existing row rather
 * than creating a second queue position, and says the same thing either way. Two entries for one
 * guest would also let somebody take two places in a queue that is ordered by `createdAt`.
 */

const RULE: RateLimitRule = { limit: 5, windowMs: 10 * 60_000 };

export interface JoinResult {
  ok: boolean;
  message?: string;
  error?: string;
}

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "").trim();

export async function joinWaitlist(_prev: JoinResult | null, fd: FormData): Promise<JoinResult> {
  const slug = str(fd, "slug");
  const property = await getPublicProperty(slug);
  // Never leak whether a hotel exists — the same generic answer as everywhere else on this app.
  if (!property) return { ok: false, error: "This booking page isn't available." };
  const { s, locale } = await serverKit(property);
  const e = s.errors;

  const ip = clientIp(await headers());
  if (!hit(`wl:${ip}:${property.id}`, RULE).ok) {
    return { ok: false, error: e.tooMany };
  }

  const name = str(fd, "name");
  const email = str(fd, "email");
  const checkIn = str(fd, "checkIn");
  const checkOut = str(fd, "checkOut");
  /*
   * `Number("abc")` is NaN, and `|| "2"` only catches an EMPTY field — letters and the comma decimal
   * a European guest types go straight through. `canJoinWaitlist` does refuse a non-finite party
   * size, but leaning on a guard one call away is exactly what money-lint exists to stop: this is
   * the one public, unauthenticated surface we have, so it is read and refused here.
   */
  const guestsRaw = str(fd, "guests");
  const guests = guestsRaw === "" ? 2 : Number(guestsRaw);
  if (!Number.isFinite(guests)) {
    return { ok: false, error: e.guests };
  }

  if (!name) return { ok: false, error: e.waitlistName };
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: e.email };

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: property.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const refusal = canJoinWaitlist({ checkIn, checkOut, guests, today });
  if (refusal) {
    // Say what is wrong in the guest's terms and language, never the enum.
    return { ok: false, error: (e.waitlist as Record<string, string>)[refusal] ?? e.waitlistGeneric };
  }

  const db = forTenant(property.tenantId);
  const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

  /*
   * Idempotent on (property, email, dates). A guest who submits twice — a double click, a second
   * visit — keeps ONE queue position, and keeps the original `createdAt`, which IS their position.
   * Creating a second row would quietly move them behind people who arrived after them.
   */
  const existing = await db.waitlistEntry.findFirst({
    where: {
      propertyId: property.id,
      guestEmail: email.toLowerCase(),
      checkIn: asDate(checkIn),
      checkOut: asDate(checkOut),
      status: { in: ["waiting", "offered"] },
    },
    select: { id: true },
  });

  if (existing) {
    await db.waitlistEntry.update({ where: { id: existing.id }, data: { guestName: name, guests } });
  } else {
    await db.waitlistEntry.create({
      data: {
        tenantId: property.tenantId,
        propertyId: property.id,
        // Any room that sleeps the party — a guest searching dates has not chosen a room type.
        roomTypeId: null,
        checkIn: asDate(checkIn),
        checkOut: asDate(checkOut),
        guests,
        guestName: name,
        guestEmail: email.toLowerCase(),
        source: "booking_engine",
      },
    });
  }

  /*
   * Confirm in writing, but never let the mail decide the outcome.
   *
   * The guest is on the list the moment the row exists; a provider having a bad minute must not turn
   * that into an error page and push them into joining twice. Same rule as the booking confirmation.
   */
  await sendTemplatedEmail(db, {
    propertyId: property.id,
    key: "waitlist_joined",
    to: [email.toLowerCase()],
    locale,
    vars: {
      guestName: name,
      holdWindow: s.waitlist.holdWindow(Math.round(DEFAULT_OFFER_TTL_MINUTES / 60)),
    },
    details: [{ label: s.bar.dates, value: `${checkIn} → ${checkOut}`, emphasis: true }],
  }).catch(() => {});

  return { ok: true, message: s.waitlist.joined(DEFAULT_OFFER_TTL_MINUTES) };
}
