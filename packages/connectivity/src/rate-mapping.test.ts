import { describe, it, expect } from "vitest";
import { indexRateMappings, resolveExternalRateId, stopSellPairs, unmappedPairs } from "./rate-mapping.js";

/**
 * The bug this replaces: a hotel with three room types and ONE "Standard Rate" mapped that plan to a
 * single Channex rate plan, and every push sent all three room types at it. Last write wins, so two
 * of the three carried the wrong price on every OTA — with the Sync Center green, because from our
 * side the push succeeded.
 */

const DOUBLE = "rt-double", TWIN = "rt-twin", SUITE = "rt-suite";
const STANDARD = "rp-standard", NONREF = "rp-nonref";

describe("resolveExternalRateId", () => {
  it("gives each room type its OWN channel rate plan", () => {
    // The fix, in one assertion. Three room types on one logical plan must reach three different
    // Channex rate plans, because Channex ties a rate plan to exactly one room type.
    const ix = indexRateMappings([
      { ratePlanId: STANDARD, roomTypeId: DOUBLE, externalRateId: "chx-double-bar" },
      { ratePlanId: STANDARD, roomTypeId: TWIN, externalRateId: "chx-twin-bar" },
      { ratePlanId: STANDARD, roomTypeId: SUITE, externalRateId: "chx-suite-bar" },
    ]);
    expect(resolveExternalRateId(ix, DOUBLE, STANDARD)).toBe("chx-double-bar");
    expect(resolveExternalRateId(ix, TWIN, STANDARD)).toBe("chx-twin-bar");
    expect(resolveExternalRateId(ix, SUITE, STANDARD)).toBe("chx-suite-bar");
  });

  it("still honours a catch-all mapping, so nothing that works today breaks", () => {
    // Every existing row, and every mock channel, has a null room type meaning "any".
    const ix = indexRateMappings([{ ratePlanId: STANDARD, roomTypeId: null, externalRateId: "booking-rp-BAR" }]);
    expect(resolveExternalRateId(ix, DOUBLE, STANDARD)).toBe("booking-rp-BAR");
    expect(resolveExternalRateId(ix, SUITE, STANDARD)).toBe("booking-rp-BAR");
  });

  it("prefers the specific mapping over a stale catch-all", () => {
    // Falling back the other way would let an old catch-all silently override a mapping somebody
    // deliberately created for one room type.
    const ix = indexRateMappings([
      { ratePlanId: STANDARD, roomTypeId: null, externalRateId: "legacy" },
      { ratePlanId: STANDARD, roomTypeId: TWIN, externalRateId: "chx-twin-bar" },
    ]);
    expect(resolveExternalRateId(ix, TWIN, STANDARD)).toBe("chx-twin-bar");
    expect(resolveExternalRateId(ix, DOUBLE, STANDARD)).toBe("legacy");
  });

  it("returns null for an unmapped pair rather than borrowing another room's rate plan", () => {
    // The dangerous alternative: push succeeds and writes the Double's price onto the Suite.
    const ix = indexRateMappings([{ ratePlanId: STANDARD, roomTypeId: DOUBLE, externalRateId: "chx-double-bar" }]);
    expect(resolveExternalRateId(ix, SUITE, STANDARD)).toBeNull();
  });

  it("treats a mapping with no external id as unmapped", () => {
    // A half-created mapping row is not a mapping. Pushing to `null` is how an empty id reaches the
    // wire and comes back as a confusing rejection.
    const ix = indexRateMappings([{ ratePlanId: STANDARD, roomTypeId: DOUBLE, externalRateId: null }]);
    expect(resolveExternalRateId(ix, DOUBLE, STANDARD)).toBeNull();
  });

  it("keeps two plans on the same room type apart", () => {
    const ix = indexRateMappings([
      { ratePlanId: STANDARD, roomTypeId: DOUBLE, externalRateId: "chx-double-bar" },
      { ratePlanId: NONREF, roomTypeId: DOUBLE, externalRateId: "chx-double-nr" },
    ]);
    expect(resolveExternalRateId(ix, DOUBLE, STANDARD)).toBe("chx-double-bar");
    expect(resolveExternalRateId(ix, DOUBLE, NONREF)).toBe("chx-double-nr");
  });
});

describe("unmappedPairs", () => {
  it("reports the gap a per-plan check used to hide", () => {
    /*
     * The old completeness rule counted mapped PLANS. One plan mapped once satisfied it, while two
     * of the hotel's three room types reached no channel at all — "All mapped", in green, over a
     * hotel selling two room types nowhere.
     */
    const ix = indexRateMappings([{ ratePlanId: STANDARD, roomTypeId: DOUBLE, externalRateId: "chx-double-bar" }]);
    const gaps = unmappedPairs(ix, [DOUBLE, TWIN, SUITE], [STANDARD]);
    expect(gaps).toHaveLength(2);
    expect(gaps.map((g) => g.roomTypeId).sort()).toEqual([SUITE, TWIN].sort());
  });

  it("reports nothing when every pair resolves", () => {
    const ix = indexRateMappings([
      { ratePlanId: STANDARD, roomTypeId: DOUBLE, externalRateId: "a" },
      { ratePlanId: STANDARD, roomTypeId: TWIN, externalRateId: "b" },
    ]);
    expect(unmappedPairs(ix, [DOUBLE, TWIN], [STANDARD])).toHaveLength(0);
  });

  it("counts a catch-all as covering every room type", () => {
    const ix = indexRateMappings([{ ratePlanId: STANDARD, roomTypeId: null, externalRateId: "any" }]);
    expect(unmappedPairs(ix, [DOUBLE, TWIN, SUITE], [STANDARD])).toHaveLength(0);
  });
});

/**
 * What a Pause closes. The live shape is DesManagement 2015 / Cabacum Beach Residence on 2026-09-22:
 * three rooms, each carrying its own BB Flex and BB Non-Refundable, and the old code sent all six
 * rates to all three rooms — eighteen pairs, of which the channel could place six.
 */
describe("stopSellPairs", () => {
  const ONE = "rt-1bed", TWO = "rt-2bed", THREE = "rt-3bed";
  const rooms = [
    { roomTypeId: ONE, externalRoomId: "ch-room-1" },
    { roomTypeId: TWO, externalRoomId: "ch-room-2" },
    { roomTypeId: THREE, externalRoomId: "ch-room-3" },
  ];
  const own = (roomTypeId: string, ratePlanId: string, externalRateId: string) => ({ roomTypeId, ratePlanId, externalRateId });
  const cabacum = [
    own(ONE, "flex", "r1-flex"), own(ONE, "nr", "r1-nr"),
    own(TWO, "flex", "r2-flex"), own(TWO, "nr", "r2-nr"),
    own(THREE, "flex", "r3-flex"), own(THREE, "nr", "r3-nr"),
  ];

  it("closes each rate on its OWN room — six pairs, not eighteen", () => {
    const pairs = stopSellPairs(rooms, cabacum);
    expect(pairs).toHaveLength(6);
    expect(pairs).toContainEqual({ externalRoomId: "ch-room-1", externalRateId: "r1-flex" });
    expect(pairs).toContainEqual({ externalRoomId: "ch-room-3", externalRateId: "r3-nr" });
  });

  it("never addresses a rate to a room it does not belong to", () => {
    // The pairs the channel cannot place. They closed nothing, and they made the push's result
    // permanently "rejected", which is why nobody could read it.
    const pairs = stopSellPairs(rooms, cabacum);
    expect(pairs).not.toContainEqual({ externalRoomId: "ch-room-2", externalRateId: "r1-flex" });
    expect(pairs.every((p) => p.externalRateId.startsWith(p.externalRoomId.replace("ch-room-", "r")))).toBe(true);
  });

  it("closes a property-wide mapping on EVERY room — closing too much is the safe error here", () => {
    // Opposite of the ARI push, which refuses a catch-all on a real channel: a PRICE through one can
    // land on the wrong room, a CLOSE through one at worst closes a pair that did not exist.
    const pairs = stopSellPairs(rooms, [{ roomTypeId: null, ratePlanId: "legacy", externalRateId: "r-legacy" }]);
    expect(pairs.map((p) => p.externalRoomId).sort()).toEqual(["ch-room-1", "ch-room-2", "ch-room-3"]);
  });

  it("still closes a plan that is switched off — whatever the channel last got for it is frozen there", () => {
    // Nothing here knows about `active`, on purpose: the caller does not filter, and neither does this.
    const withStale = [...cabacum, own(TWO, "standard-switched-off", "r-stale")];
    expect(stopSellPairs(rooms, withStale)).toContainEqual({ externalRoomId: "ch-room-2", externalRateId: "r-stale" });
  });

  it("sends each pair once, however it was reached", () => {
    const dup = [own(ONE, "flex", "r1-flex"), { roomTypeId: null, ratePlanId: "flex", externalRateId: "r1-flex" }];
    const pairs = stopSellPairs([rooms[0]!], dup);
    expect(pairs).toEqual([{ externalRoomId: "ch-room-1", externalRateId: "r1-flex" }]);
  });

  it("skips a room the channel has no id for, rather than sending an empty one", () => {
    expect(stopSellPairs([{ roomTypeId: ONE, externalRoomId: null }], cabacum)).toEqual([]);
  });

  it("returns nothing when nothing is mapped — a pause with nothing to close is not a failure", () => {
    expect(stopSellPairs(rooms, [])).toEqual([]);
  });
});

