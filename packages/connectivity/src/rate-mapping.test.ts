import { describe, it, expect } from "vitest";
import { indexRateMappings, resolveExternalRateId, unmappedPairs } from "./rate-mapping.js";

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
