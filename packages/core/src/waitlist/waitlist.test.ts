import { describe, it, expect } from "vitest";
import {
  matchesEntry, nextOfferable, canJoinWaitlist, stayNightsList, offerDeadline,
  isOfferExpired, isStale, describeJoin, MAX_OFFERS_PER_ENTRY, DEFAULT_OFFER_TTL_MINUTES,
  type WaitlistEntryFacts, type RoomAvailability,
} from "./waitlist.js";

const entry = (over: Partial<WaitlistEntryFacts> = {}): WaitlistEntryFacts => ({
  id: "w1", roomTypeId: null, checkIn: "2026-09-10", checkOut: "2026-09-13", guests: 2,
  status: "waiting", createdAt: new Date("2026-09-01T10:00:00Z"), offerCount: 0, ...over,
});

/** A room free for the whole 10th–13th stay (nights 10, 11, 12). */
const room = (over: Partial<RoomAvailability> = {}): RoomAvailability => ({
  roomTypeId: "double", maxGuests: 2,
  freeNights: ["2026-09-10", "2026-09-11", "2026-09-12"], ...over,
});

describe("the nights a stay actually occupies", () => {
  it("excludes the checkout date — it is a boundary, not a night sold", () => {
    expect(stayNightsList("2026-09-10", "2026-09-13")).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("a one-night stay is one night", () => {
    expect(stayNightsList("2026-09-10", "2026-09-11")).toEqual(["2026-09-10"]);
  });

  it("a zero-night stay occupies nothing", () => {
    expect(stayNightsList("2026-09-10", "2026-09-10")).toEqual([]);
  });
});

describe("matching a freed room to an entry", () => {
  it("matches when every night is free and the room sleeps the party", () => {
    expect(matchesEntry(entry(), room())).toBe(true);
  });

  it("THE PARTIAL-MATCH TRAP: one missing night is not a match", () => {
    // The guest asked for three nights. Emailing them about two is a disappointment with a link on it.
    expect(matchesEntry(entry(), room({ freeNights: ["2026-09-10", "2026-09-11"] }))).toBe(false);
  });

  it("respects stop sell — a withdrawal is a decision, not an oversight", () => {
    const r = room({ stopSoldNights: ["2026-09-11"] });
    expect(matchesEntry(entry(), r)).toBe(false);
  });

  it("refuses a room that cannot sleep the party", () => {
    expect(matchesEntry(entry({ guests: 4 }), room({ maxGuests: 2 }))).toBe(false);
  });

  it("an entry naming a room type only matches that room type", () => {
    expect(matchesEntry(entry({ roomTypeId: "suite" }), room({ roomTypeId: "double" }))).toBe(false);
    expect(matchesEntry(entry({ roomTypeId: "double" }), room({ roomTypeId: "double" }))).toBe(true);
  });

  it("an entry naming no room type takes any room that fits — unscoped means everything", () => {
    expect(matchesEntry(entry({ roomTypeId: null }), room({ roomTypeId: "anything" }))).toBe(true);
  });

  it("only a waiting entry is matchable", () => {
    for (const status of ["offered", "converted", "expired", "cancelled"] as const) {
      expect(matchesEntry(entry({ status }), room())).toBe(false);
    }
  });

  it("stops offering after the cap — a fourth email is a nuisance, not a service", () => {
    expect(matchesEntry(entry({ offerCount: MAX_OFFERS_PER_ENTRY - 1 }), room())).toBe(true);
    expect(matchesEntry(entry({ offerCount: MAX_OFFERS_PER_ENTRY }), room())).toBe(false);
  });
});

describe("who gets the offer", () => {
  it("the OLDEST matching entry, not the first in the array", () => {
    const later = entry({ id: "b", createdAt: new Date("2026-09-02T09:00:00Z") });
    const earlier = entry({ id: "a", createdAt: new Date("2026-09-01T09:00:00Z") });
    expect(nextOfferable([later, earlier], room())!.id).toBe("a");
  });

  it("skips entries the room does not satisfy, even if they are older", () => {
    const oldButTooBig = entry({ id: "old", guests: 6, createdAt: new Date("2026-01-01T00:00:00Z") });
    const newer = entry({ id: "new", guests: 2, createdAt: new Date("2026-09-05T00:00:00Z") });
    expect(nextOfferable([oldButTooBig, newer], room({ maxGuests: 2 }))!.id).toBe("new");
  });

  it("returns null when nobody qualifies rather than offering to somebody who does not fit", () => {
    expect(nextOfferable([entry({ guests: 9 })], room({ maxGuests: 2 }))).toBeNull();
    expect(nextOfferable([], room())).toBeNull();
  });

  it("is stable when two entries were created in the same millisecond", () => {
    const at = new Date("2026-09-01T10:00:00Z");
    const a = entry({ id: "aaa", createdAt: at });
    const b = entry({ id: "bbb", createdAt: at });
    expect(nextOfferable([b, a], room())!.id).toBe("aaa");
    expect(nextOfferable([a, b], room())!.id).toBe("aaa");
  });
});

describe("joining is refused for stays that can never be filled", () => {
  const today = "2026-09-05";

  it("accepts a normal future stay", () => {
    expect(canJoinWaitlist({ checkIn: "2026-09-10", checkOut: "2026-09-12", guests: 2, today })).toBeNull();
  });

  it("refuses a stay whose arrival has passed", () => {
    expect(canJoinWaitlist({ checkIn: "2026-09-01", checkOut: "2026-09-03", guests: 2, today })).toBe("in-the-past");
  });

  it("allows a stay arriving today — the hotel's today, passed in", () => {
    expect(canJoinWaitlist({ checkIn: today, checkOut: "2026-09-07", guests: 2, today })).toBeNull();
  });

  it("refuses departure on or before arrival", () => {
    expect(canJoinWaitlist({ checkIn: "2026-09-10", checkOut: "2026-09-10", guests: 2, today }))
      .toBe("departure-before-arrival");
  });

  it("refuses unreadable dates rather than guessing", () => {
    expect(canJoinWaitlist({ checkIn: "nonsense", checkOut: "2026-09-12", guests: 2, today })).toBe("invalid-dates");
  });

  it("refuses a party of zero, and one larger than anything the hotel has", () => {
    expect(canJoinWaitlist({ checkIn: "2026-09-10", checkOut: "2026-09-12", guests: 0, today })).toBe("no-guests");
    expect(canJoinWaitlist({ checkIn: "2026-09-10", checkOut: "2026-09-12", guests: 9, today, maxGuests: 4 }))
      .toBe("too-many-guests");
  });
});

describe("the offer window", () => {
  it("defaults to hours, not the checkout hold's minutes — an offer arrives by email", () => {
    expect(DEFAULT_OFFER_TTL_MINUTES).toBeGreaterThan(60);
    const now = new Date("2026-09-05T10:00:00Z");
    expect(offerDeadline(now).getTime() - now.getTime()).toBe(DEFAULT_OFFER_TTL_MINUTES * 60_000);
  });

  it("expires only an entry that actually holds an offer", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const past = new Date("2026-09-05T11:00:00Z");
    expect(isOfferExpired(entry({ status: "offered", offerExpiresAt: past }), now)).toBe(true);
    expect(isOfferExpired(entry({ status: "waiting", offerExpiresAt: past }), now)).toBe(false);
    expect(isOfferExpired(entry({ status: "offered", offerExpiresAt: null }), now)).toBe(false);
  });

  it("knows when an entry can never be filled again", () => {
    expect(isStale(entry({ checkIn: "2026-09-01" }), "2026-09-05")).toBe(true);
    expect(isStale(entry({ checkIn: "2026-09-10" }), "2026-09-05")).toBe(false);
  });
});

describe("what the guest is told", () => {
  it("states the hold window and never a queue position", () => {
    const s = describeJoin();
    expect(s).toMatch(/4 hours/);
    expect(s).not.toMatch(/number|position|\bqueue\b/i);
  });

  it("says minutes when the window is short", () => {
    expect(describeJoin(30)).toMatch(/30 minutes/);
  });
});
