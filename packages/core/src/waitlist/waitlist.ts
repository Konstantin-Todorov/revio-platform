import { addDays, nightsBetween, isValidISO } from "../stays/calendar.js";

/**
 * The waitlist — who gets offered a room that just came free, and who does not.
 *
 * ## Why this is pure, and here
 *
 * A sold-out date is demand the hotel already paid to attract. Today RevioDirect answers it with real
 * alternative stays and then forgets it, so a cancellation an hour later tells nobody. The rules for
 * *who* is then offered the room are judgements a revenue manager will argue with — whole-stay only,
 * stop-sell respected, oldest first — so they live in one tested function rather than inside a job.
 *
 * ## The rule that shapes everything else
 *
 * **An offer is sequential and backed by a real `Hold`.** The obvious alternative — email everyone
 * who wanted those dates — creates a race: five guests click, one gets the room, and four are told it
 * has gone *after being told it was available*. That is worse than never writing to them at all.
 *
 * So this module answers one question at a time: given a room that is now free, **which single entry
 * gets the offer?** The caller places the hold and sends the mail.
 */

export type WaitlistStatus = "waiting" | "offered" | "converted" | "expired" | "cancelled";

export interface WaitlistEntryFacts {
  id: string;
  /** `null` means "any room that sleeps my party" — the same unscoped-means-everything convention. */
  roomTypeId: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: WaitlistStatus;
  /** Position in the queue IS this, ascending. Never a stored integer — see below. */
  createdAt: Date;
  /** How many times this entry has been offered a room and let it lapse. */
  offerCount: number;
  offerExpiresAt?: Date | null;
}

/** What one room type can actually sell, per night, right now. */
export interface RoomAvailability {
  roomTypeId: string;
  /** The occupancy ceiling, NOT the number of rooms. */
  maxGuests: number;
  /** Nights with at least one room left. The checkout date is not a night. */
  freeNights: readonly string[];
  /** Nights the hotel has deliberately withdrawn from sale. */
  stopSoldNights?: readonly string[];
}

/**
 * Offer at most this many times before leaving somebody alone.
 *
 * A guest who has ignored three offers is not waiting any more, and a fourth email is the difference
 * between a service and a nuisance.
 */
export const MAX_OFFERS_PER_ENTRY = 3;

/** The nights a stay occupies. Check-out is an arrival-to-departure boundary, never a night sold. */
export function stayNightsList(checkIn: string, checkOut: string): string[] {
  const n = nightsBetween(checkIn, checkOut);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(checkIn, i));
  return out;
}

export type JoinRefusal =
  | "invalid-dates"
  | "departure-before-arrival"
  | "in-the-past"
  | "too-many-guests"
  | "no-guests";

/**
 * May this stay go on the list at all? `null` means yes.
 *
 * `today` is the property's own today, passed in — the server's midnight is not the hotel's, and a
 * stay starting "today" in Sofia is still joinable at 23:00 in London.
 */
export function canJoinWaitlist(args: {
  checkIn: string;
  checkOut: string;
  guests: number;
  today: string;
  maxGuests?: number;
}): JoinRefusal | null {
  if (!isValidISO(args.checkIn) || !isValidISO(args.checkOut)) return "invalid-dates";
  if (nightsBetween(args.checkIn, args.checkOut) < 1) return "departure-before-arrival";
  // A waitlist for a date that has passed cannot ever be filled.
  if (args.checkIn < args.today) return "in-the-past";
  if (!Number.isFinite(args.guests) || args.guests < 1) return "no-guests";
  if (args.maxGuests != null && args.guests > args.maxGuests) return "too-many-guests";
  return null;
}

/**
 * Does this freed-up room actually satisfy this entry?
 *
 * ⚠️ **Every night, or none.** A partial match is not an offer, it is a disappointment with a link on
 * it — the guest asked for four nights and we would be emailing about three.
 */
export function matchesEntry(entry: WaitlistEntryFacts, room: RoomAvailability): boolean {
  if (entry.status !== "waiting") return false;
  if (entry.offerCount >= MAX_OFFERS_PER_ENTRY) return false;
  if (entry.roomTypeId != null && entry.roomTypeId !== room.roomTypeId) return false;
  if (room.maxGuests < entry.guests) return false;

  const nights = stayNightsList(entry.checkIn, entry.checkOut);
  if (nights.length === 0) return false;

  const free = new Set(room.freeNights);
  // Stop sell is a DECISION. A waitlist that ignores it sells rooms the hotel deliberately withdrew,
  // which is the one way this feature could actively harm the person who turned it on.
  const stopped = new Set(room.stopSoldNights ?? []);
  return nights.every((n) => free.has(n) && !stopped.has(n));
}

/**
 * Who gets the offer — the **oldest** waiting entry this room satisfies, or `null`.
 *
 * Position is derived from `createdAt` rather than stored. A stored position has to be renumbered on
 * every insert, cancellation and conversion, and the first time that renumbering is wrong somebody is
 * told they are second when they are fourth.
 *
 * Ties break on `id` so the answer is stable: two entries created in the same millisecond must not
 * swap places between two runs of the same sweep.
 */
export function nextOfferable(
  entries: readonly WaitlistEntryFacts[],
  room: RoomAvailability,
): WaitlistEntryFacts | null {
  const eligible = entries.filter((e) => matchesEntry(e, room));
  if (eligible.length === 0) return null;
  return [...eligible].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1),
  )[0]!;
}

/**
 * When an offer lapses.
 *
 * Deliberately NOT the booking engine's hold TTL. That one is tuned for somebody with the checkout
 * open in front of them; an offer arrives by email and the guest may be asleep. Thirty minutes
 * optimises for the wrong failure — the room sits held while the only person who could take it is in
 * bed, and then goes to nobody.
 */
export const DEFAULT_OFFER_TTL_MINUTES = 4 * 60;

export function offerDeadline(now: Date, ttlMinutes = DEFAULT_OFFER_TTL_MINUTES): Date {
  return new Date(now.getTime() + Math.max(1, Math.round(ttlMinutes)) * 60_000);
}

/** Has an outstanding offer run out? Only ever true for an entry actually holding one. */
export function isOfferExpired(entry: WaitlistEntryFacts, now: Date): boolean {
  if (entry.status !== "offered" || !entry.offerExpiresAt) return false;
  return entry.offerExpiresAt.getTime() <= now.getTime();
}

/**
 * Is this entry past the point of being fillable at all?
 *
 * Once the arrival date has passed there is nothing left to offer, whatever the queue says.
 */
export function isStale(entry: WaitlistEntryFacts, today: string): boolean {
  return entry.checkIn < today;
}

/**
 * What the guest is told when they join.
 *
 * We never publish a queue position. It is real, but it moves for reasons a guest cannot see — an
 * earlier entry converts, another is cancelled — and a number that goes **up** reads as a bug in our
 * software rather than as somebody else's good luck.
 */
export function describeJoin(ttlMinutes = DEFAULT_OFFER_TTL_MINUTES): string {
  const hours = Math.round(ttlMinutes / 60);
  const window = ttlMinutes >= 120 ? `${hours} hours` : `${ttlMinutes} minutes`;
  return `You're on the list. If a room opens up we'll email you, and it's held for ${window} so you have time to book it.`;
}
