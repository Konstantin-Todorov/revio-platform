import { describe, expect, it } from "vitest";
import {
  BED_SETUPS,
  CARD_AMENITY_PRIORITY,
  ROOM_AMENITIES,
  ROOM_AMENITY_BY_KEY,
  ROOM_AMENITY_GROUPS,
  groupAmenities,
  headlineAmenities,
  resolveAmenities,
} from "./amenities.js";

/**
 * The vocabulary is data, and data this shape breaks in quiet ways: a renamed key empties that
 * amenity on every room that had it, a duplicate makes one entry unreachable, a key in the card
 * priority list that no longer exists drops a room's best feature off its card. None of those throw.
 * They just make the product slightly wrong for one hotel, which is exactly what nobody notices.
 */
describe("the room amenity vocabulary", () => {
  it("has no duplicate keys", () => {
    const keys = ROOM_AMENITIES.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts every amenity in a group that is actually rendered", () => {
    const groups = new Set(ROOM_AMENITY_GROUPS.map((g) => g.key));
    for (const a of ROOM_AMENITIES) expect(groups.has(a.group)).toBe(true);
  });

  it("gives every amenity and bed setup an icon", () => {
    for (const a of ROOM_AMENITIES) expect(a.icon.length).toBeGreaterThan(0);
    for (const b of BED_SETUPS) expect(b.icon.length).toBeGreaterThan(0);
  });

  it("only promotes amenities that exist", () => {
    for (const key of CARD_AMENITY_PRIORITY) expect(ROOM_AMENITY_BY_KEY[key]).toBeDefined();
  });
});

describe("resolveAmenities", () => {
  it("drops anything it does not recognise, so a stale or forged key never reaches a guest", () => {
    expect(resolveAmenities(["wifi", "not_a_real_amenity", ""]).map((a) => a.key)).toEqual(["wifi"]);
  });

  it("returns list order, not the order the hotel happened to tick them in", () => {
    // "wifi" sits before "balcony" in the curated list; the stored array here is the other way round.
    expect(resolveAmenities(["balcony", "wifi"]).map((a) => a.key)).toEqual(["wifi", "balcony"]);
  });
});

describe("groupAmenities", () => {
  it("skips groups the room has nothing in", () => {
    const groups = groupAmenities(["wifi", "sea_view"]);
    expect(groups.map((g) => g.group)).toEqual(["comfort", "view"]);
    expect(groups.flatMap((g) => g.items).length).toBe(2);
  });

  it("returns nothing at all for a room with no amenities", () => {
    expect(groupAmenities([])).toEqual([]);
  });
});

describe("headlineAmenities", () => {
  it("ranks what distinguishes a room above what every room has", () => {
    // The whole point: a card that led with air conditioning would say the same thing on every row.
    const picked = headlineAmenities(["air_conditioning", "wifi", "sea_view", "balcony", "tv"]);
    expect(picked.map((a) => a.key)).toEqual(["sea_view", "balcony", "air_conditioning", "wifi"]);
  });

  it("never returns more than the card has room for", () => {
    expect(headlineAmenities(ROOM_AMENITIES.map((a) => a.key)).length).toBe(4);
    expect(headlineAmenities(ROOM_AMENITIES.map((a) => a.key), 2).length).toBe(2);
  });

  it("returns nothing when the room has only amenities that never earn a card slot", () => {
    // "Iron & board" is real and worth listing in the detail view; it does not sell a room.
    expect(headlineAmenities(["iron", "hairdryer"])).toEqual([]);
  });
});
