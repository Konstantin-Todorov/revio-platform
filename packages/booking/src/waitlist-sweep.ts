import { randomUUID } from "node:crypto";
import type { forTenant } from "@revio/db";
import {
  nextOfferable,
  offerDeadline,
  isStale,
  stayNightsList,
  DEFAULT_OFFER_TTL_MINUTES,
  type WaitlistEntryFacts,
  type RoomAvailability,
} from "@revio/core";
import { publicAvailability, publicCreateHold, publicReleaseHold } from "./public-engine.js";

type Db = ReturnType<typeof forTenant>;
type PropertyRow = { id: string; tenantId: string; name: string; baseCurrency: string; timezone: string };

/**
 * The waitlist sweep — the only thing that turns a freed room into an offer.
 *
 * ## Why one sweep instead of six hooks
 *
 * Availability "appears" in at least six places: a cancellation, a no-show, an expired hold, an OOO
 * period ending, a stop-sell being lifted, and a channel pulling a booking back. Hooking each one
 * means six chances to forget the seventh. This runs in one place and asks the availability engine
 * what is *actually* sellable now, so a route nobody thought of still ends up served.
 *
 * ## The race this is built to avoid
 *
 * The obvious design — email everyone who wanted those dates — creates a race: five guests click,
 * one gets the room, four are told it has gone **after being told it was free**. That is worse than
 * never writing to them. So an offer is sequential and backed by a real `Hold`: one entry at a time,
 * the room genuinely reserved for them, and the next person only hears anything if that offer lapses.
 *
 * ## Ordering inside a run
 *
 * Expiries are processed **before** offers, deliberately. A lapsed offer releases a hold, and that
 * hold is inventory the very next step may be able to offer to someone else. Running offers first
 * would make each sweep see the world as it was one tick ago.
 *
 * ## Failure shape
 *
 * Creating the hold and marking the entry `offered` are two writes and are not atomic here — the
 * RLS proxy forwards `prisma.<model>.<op>` only. The failure is deliberately one-directional: if the
 * second write fails, an unclaimed hold exists that no entry points at, and the hold-expiry job
 * releases it within its TTL. The reverse — an entry marked `offered` with no hold behind it — would
 * email a guest about a room that was never reserved, so the hold is always created first.
 */

export interface SweepResult {
  /** Offers made in this run. */
  offered: number;
  /** Offers that ran out and went back on the list. */
  lapsed: number;
  /** Entries whose arrival date has passed and can never be filled. */
  staled: number;
  /** For the caller to send `waitlist_offer` — the only email that makes a hold meaningful. */
  offers: {
    entryId: string;
    guestName: string;
    guestEmail: string;
    locale: string | null;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    claimToken: string;
    expiresAt: Date;
  }[];
  /** For the caller to send `waitlist_expired` — "still on the list". */
  lapsedEntries: { entryId: string; guestName: string; guestEmail: string; locale: string | null }[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function waitlistSweep(
  db: Db,
  property: PropertyRow,
  opts: { now?: Date; ttlMinutes?: number } = {},
): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const ttl = opts.ttlMinutes ?? DEFAULT_OFFER_TTL_MINUTES;
  const today = todayInTz(property.timezone);

  const result: SweepResult = { offered: 0, lapsed: 0, staled: 0, offers: [], lapsedEntries: [] };

  // ── 1. Lapsed offers, first, because they hand inventory back to step 3. ──────────────────
  const lapsedRows = await db.waitlistEntry.findMany({
    where: { propertyId: property.id, status: "offered", offerExpiresAt: { lte: now } },
    select: { id: true, guestName: true, guestEmail: true, locale: true, offerHoldId: true },
  });

  for (const row of lapsedRows) {
    if (row.offerHoldId) {
      // Best effort: the hold-expiry job also releases this. Failing here must not stop the sweep,
      // or one stuck hold freezes the whole queue.
      await publicReleaseHold(db, property.id, row.offerHoldId).catch(() => {});
    }
    await db.waitlistEntry.update({
      where: { id: row.id },
      // Back to `waiting`, not `expired`: the guest missed one offer, they did not leave the queue.
      // `offerCount` was already incremented when the offer went out, and core stops offering at
      // MAX_OFFERS_PER_ENTRY so this cannot loop forever.
      data: { status: "waiting", offerHoldId: null, offerExpiresAt: null, claimToken: null },
    });
    result.lapsed++;
    result.lapsedEntries.push({
      entryId: row.id,
      guestName: row.guestName,
      guestEmail: row.guestEmail,
      locale: row.locale,
    });
  }

  // ── 2. Entries that can never be filled. ─────────────────────────────────────────────────
  const waiting = await db.waitlistEntry.findMany({
    where: { propertyId: property.id, status: "waiting" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, roomTypeId: true, checkIn: true, checkOut: true, guests: true,
      status: true, createdAt: true, offerCount: true, offerExpiresAt: true,
      guestName: true, guestEmail: true, locale: true,
    },
  });

  const live: typeof waiting = [];
  for (const row of waiting) {
    const facts = toFacts(row);
    if (isStale(facts, today)) {
      await db.waitlistEntry.update({ where: { id: row.id }, data: { status: "expired" } });
      result.staled++;
      continue;
    }
    live.push(row);
  }
  if (live.length === 0) return result;

  // ── 3. Offers. One availability lookup per distinct stay window, not per entry. ───────────
  const windows = new Map<string, typeof live>();
  for (const row of live) {
    const key = `${ymd(row.checkIn)}|${ymd(row.checkOut)}|${row.guests}`;
    const bucket = windows.get(key);
    if (bucket) bucket.push(row);
    else windows.set(key, [row]);
  }

  for (const [key, rows] of windows) {
    const [checkIn, checkOut, guestsRaw] = key.split("|") as [string, string, string];
    const guests = Number(guestsRaw);

    const { options, error } = await publicAvailability(db, property, { checkIn, checkOut, guests });
    if (error || !options || options.length === 0) continue;

    const facts = rows.map(toFacts);
    const nights = stayNightsList(checkIn, checkOut);

    for (const option of options) {
      if (option.remaining < 1) continue;

      /*
       * `remaining` is the MINIMUM across the stay's nights, so `remaining >= 1` already means every
       * night is sellable — which is exactly the "every night or none" rule core enforces. It also
       * means stop-sold nights are already excluded, because the same engine that computes this
       * subtracts them; passing `stopSoldNights` again here would be double-counting a decision the
       * availability waterfall has already made.
       */
      const room: RoomAvailability = {
        roomTypeId: option.roomTypeId,
        maxGuests: option.maxGuests,
        freeNights: nights,
      };

      const winner = nextOfferable(facts, room);
      if (!winner) continue;

      const { hold, error: holdError } = await publicCreateHold(db, property, {
        checkIn, checkOut, guests, roomTypeId: option.roomTypeId,
      });
      // Someone booked it between the availability read and here. Correct outcome: say nothing.
      if (holdError || !hold) continue;

      const claimToken = randomUUID();
      const expiresAt = offerDeadline(now, ttl);
      await db.waitlistEntry.update({
        where: { id: winner.id },
        data: {
          status: "offered",
          offeredAt: now,
          offerHoldId: hold.id,
          offerExpiresAt: expiresAt,
          offerCount: { increment: 1 },
          claimToken,
        },
      });

      const row = rows.find((r) => r.id === winner.id)!;
      result.offered++;
      result.offers.push({
        entryId: winner.id,
        guestName: row.guestName,
        guestEmail: row.guestEmail,
        locale: row.locale,
        roomTypeId: option.roomTypeId,
        checkIn, checkOut,
        claimToken,
        expiresAt,
      });

      // One offer per room type per sweep. The room we just held is gone; anything else this window
      // could match will be found on the next run, against availability that is actually current.
      const i = facts.findIndex((f) => f.id === winner.id);
      if (i >= 0) facts.splice(i, 1);
    }
  }

  return result;
}

function toFacts(row: {
  id: string; roomTypeId: string | null; checkIn: Date; checkOut: Date; guests: number;
  status: string; createdAt: Date; offerCount: number; offerExpiresAt: Date | null;
}): WaitlistEntryFacts {
  return {
    id: row.id,
    roomTypeId: row.roomTypeId,
    checkIn: ymd(row.checkIn),
    checkOut: ymd(row.checkOut),
    guests: row.guests,
    status: row.status as WaitlistEntryFacts["status"],
    createdAt: row.createdAt,
    offerCount: row.offerCount,
    offerExpiresAt: row.offerExpiresAt,
  };
}
