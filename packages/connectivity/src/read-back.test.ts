import { describe, expect, it } from "vitest";
import { judgeReadBack } from "./read-back.js";
import type { PublishedComparison, RestrictionFinding } from "./published-check.js";

const noRooms = { mismatched: 0, examples: [] };
const row = (p: Partial<PublishedComparison> & Pick<PublishedComparison, "kind" | "externalRateId">): PublishedComparison => ({
  date: "2026-10-01", ours: 11100, theirs: 9990, roomTypeName: "Apartment, 1 Bedroom", ratePlanName: "BB NR", ...p,
});

describe("judgeReadBack — what the first production read taught (2026-09-29)", () => {
  it("does not count a plan Channex derives, and names it instead", () => {
    // Cabacum: BB Non-Refundable is BB BAR −10% inside Channex. 93 nights "differed"; none was ours.
    const j = judgeReadBack({
      priceProblems: Array.from({ length: 93 }, () => row({ kind: "mismatch", externalRateId: "nr" })),
      channelPlans: { nr: { name: "BB Non-Refundable", derivedFrom: "BB BAR" } },
      mappedRateIds: new Set(["nr"]),
      rooms: noRooms,
    });
    expect(j.priceFaults).toBe(0);
    expect(j.derivedPlans).toEqual(["BB Non-Refundable (from BB BAR)"]);
    expect(j.headline).toMatch(/^Publishing exactly what we send\. Channex computes BB Non-Refundable/);
  });

  it("ignores prices on a plan we do not send to at all", () => {
    // 186 "published that we did not send" — every one on plans nobody mapped.
    const j = judgeReadBack({
      priceProblems: [row({ kind: "unexpected", externalRateId: "someone-elses", ours: null })],
      mappedRateIds: new Set(["ours"]),
      rooms: noRooms,
    });
    expect(j.priceFaults).toBe(0);
  });

  it("DOES count a price on a plan we map, on a night we sent nothing — a mis-mapping's footprint", () => {
    const j = judgeReadBack({
      // As comparePublished emits it: an unexpected price has no room or plan name of ours.
      priceProblems: [{ kind: "unexpected", externalRateId: "ours", date: "2026-10-01", ours: null, theirs: 66600 }],
      channelPlans: { ours: { name: "Standard Rate" } },
      mappedRateIds: new Set(["ours"]),
      rooms: noRooms,
    });
    expect(j.priceFaults).toBe(1);
    expect(j.examples[0]).toBe("Standard Rate 2026-10-01: the channel sells at 666.00, we send no price that night");
  });
});

describe("judgeReadBack — faults", () => {
  it("counts a wrong price and a price that never arrived, and says which is which", () => {
    const j = judgeReadBack({
      priceProblems: [
        row({ kind: "mismatch", externalRateId: "a" }),
        row({ kind: "missing", externalRateId: "a", date: "2026-10-02", theirs: null }),
      ],
      mappedRateIds: new Set(["a"]),
      rooms: noRooms,
    });
    expect(j.priceFaults).toBe(2);
    expect(j.examples).toEqual([
      "Apartment, 1 Bedroom · BB NR 2026-10-01: we send 111.00, the channel sells at 99.90",
      "Apartment, 1 Bedroom · BB NR 2026-10-02: we send 111.00, the channel shows no price",
    ]);
    expect(j.headline).toBe("2 priced nights published differently from what we send");
  });

  it("counts room-nights from the availability read, including ones not shown as examples", () => {
    const j = judgeReadBack({
      priceProblems: [],
      mappedRateIds: new Set(),
      rooms: { mismatched: 12, examples: [{ roomTypeName: "Studio", date: "2026-10-03", ours: 1, theirs: 3, closedByStopSell: false }] },
    });
    expect(j.roomFaults).toBe(12);
    expect(j.examples).toEqual(["Studio 2026-10-03: we send 1 room, the channel offers 3"]);
    expect(j.headline).toBe("12 room-nights published differently from what we send");
  });

  it("reports a clean read as clean", () => {
    const j = judgeReadBack({ priceProblems: [], mappedRateIds: new Set(), rooms: noRooms });
    expect(j).toMatchObject({ priceFaults: 0, roomFaults: 0, derivedPlans: [], examples: [], headline: "Publishing exactly what we send" });
  });
});

describe("judgeReadBack — restrictions", () => {
  const f = (over: Partial<RestrictionFinding> = {}): RestrictionFinding => ({
    externalRateId: "bar", date: "2026-10-05", label: "Studio · BAR", field: "minStay", ours: 3, theirs: 1, ...over,
  });

  it("counts one fault per rate-plan night, however many of its fields differ", () => {
    const j = judgeReadBack({
      priceProblems: [], mappedRateIds: new Set(["bar"]), rooms: noRooms,
      restrictions: [f(), f({ field: "cta", ours: true, theirs: false }), f({ date: "2026-10-06" })],
    });
    expect(j.restrictionFaults).toBe(2);
    expect(j.headline).toBe("2 nights of restrictions published differently from what we send");
    expect(j.examples[0]).toBe("Studio · BAR 2026-10-05: minimum stay — we send 3 nights, the channel has none");
  });

  it("names a derived plan's restrictions instead of counting them", () => {
    const j = judgeReadBack({
      priceProblems: [], mappedRateIds: new Set(["nr"]), rooms: noRooms,
      channelPlans: { nr: { name: "BB NR", derivedFrom: "BB BAR" } },
      restrictions: [f({ externalRateId: "nr" })],
    });
    expect(j.restrictionFaults).toBe(0);
    expect(j.derivedPlans).toEqual(["BB NR (from BB BAR)"]);
  });
});

