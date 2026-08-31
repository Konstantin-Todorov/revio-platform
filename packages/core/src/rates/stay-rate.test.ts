import { describe, it, expect } from "vitest";
import { nightRate, stayTotal, nightsToReprice, repriceNote, type StayNight } from "./stay-rate.js";

describe("the PMS bills what was quoted", () => {
  it("uses the snapshot, NOT a live resolve, when both exist", () => {
    // The whole point. A guest confirmed at €120 is billed €120 even after somebody edits the rate
    // table to €132 — otherwise the folio disagrees with their confirmation email and the OTA.
    const r = nightRate({ snapshotMinor: 12000, resolvedMinor: 13200 });
    expect(r.minor).toBe(12000);
    expect(r.source).toBe("snapshot");
  });

  it("falls back to a live resolve only when there is no snapshot", () => {
    // A stay booked before OBP, or imported without nightly rates.
    const r = nightRate({ resolvedMinor: 13200 });
    expect(r).toMatchObject({ minor: 13200, source: "resolved" });
    // Flagged, because it is the one path where the bill can move under the guest's feet.
    expect(r.note).toMatch(/current rate/i);
  });

  it("returns null rather than zero when nothing can price the night", () => {
    expect(nightRate({})).toMatchObject({ minor: null, source: "none" });
  });
});

describe("precedence", () => {
  it("a manual override outranks the snapshot", () => {
    expect(nightRate({ overrideMinor: 9000, snapshotMinor: 12000 })).toMatchObject({
      minor: 9000, source: "override",
    });
  });

  it("an override outranks even a comp — somebody decided this stay costs this", () => {
    expect(nightRate({ overrideMinor: 5000, comp: true, snapshotMinor: 12000 }).minor).toBe(5000);
  });

  it("comp bills zero whatever was quoted, and says why", () => {
    const r = nightRate({ comp: true, snapshotMinor: 12000, resolvedMinor: 13000 });
    expect(r.minor).toBe(0);
    expect(r.source).toBe("comp");
    // A bare zero on a folio is something a receptionist has to explain.
    expect(r.note).toMatch(/complimentary/i);
  });

  it("an override of zero is honoured, not treated as absent", () => {
    expect(nightRate({ overrideMinor: 0, snapshotMinor: 12000 })).toMatchObject({ minor: 0, source: "override" });
  });
});

describe("stayTotal", () => {
  const nights = (vals: (number | null)[]): StayNight[] =>
    vals.map((minor, i) => ({ date: `2026-09-0${i + 1}`, occupancy: 2, minor, source: "snapshot" as const }));

  it("sums the priced nights", () => {
    expect(stayTotal(nights([12000, 12000, 13000]))).toEqual({ totalMinor: 37000, unpriced: 0 });
  });

  it("counts unpriced nights instead of treating them as free", () => {
    expect(stayTotal(nights([12000, null, 13000]))).toEqual({ totalMinor: 25000, unpriced: 1 });
  });
});

describe("a change reprices forward only", () => {
  const nights = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((date) => ({ date }));

  it("leaves already-slept nights alone", () => {
    // A guest adding a second person on Thursday does not owe the double rate for Monday. Those
    // nights were slept at one occupancy and have very likely been posted.
    expect(nightsToReprice(nights, "2026-09-03")).toEqual(["2026-09-03", "2026-09-04"]);
  });

  it("includes the change date itself — that night is slept at the new occupancy", () => {
    expect(nightsToReprice(nights, "2026-09-03")).toContain("2026-09-03");
  });

  it("reprices the whole stay when the change is on arrival", () => {
    expect(nightsToReprice(nights, "2026-09-01")).toHaveLength(4);
  });

  it("reprices nothing when the change is after departure", () => {
    expect(nightsToReprice(nights, "2026-09-09")).toEqual([]);
  });
});

describe("repriceNote", () => {
  it("says what changed, in guests", () => {
    expect(repriceNote("occupancy_change", 1, 2)).toBe("Repriced for 2 guests (was 1)");
    expect(repriceNote("occupancy_change", 2, 1)).toBe("Repriced for 1 guest (was 2)");
  });
  it("names a room move", () => {
    expect(repriceNote("room_move", 2, 2)).toMatch(/new room type/i);
  });
  it("says nothing for the original booking — that is not a change", () => {
    expect(repriceNote("booking", 2, 2)).toBeNull();
  });
});
