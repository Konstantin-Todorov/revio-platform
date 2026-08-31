import { describe, it, expect } from "vitest";
import {
  linkAuthority, crsAuthority, findDivergences, divergenceNote, reassertionNeedsPush,
} from "./authorship.js";

describe("the pricing MODEL is single-owned, not conflict-resolved", () => {
  it("Link cannot change the model when a CRS is connected", () => {
    // A value conflict is recoverable; a MODEL mismatch is structural. If the CRS prices per person
    // and Link flips to per-room, the occupancy rows stop existing — the ARI data is not stale, it
    // is incoherent, and there is nothing to reassert.
    const a = linkAuthority("crs_linked");
    expect(a.canEditModel).toBe(false);
    expect(a.note).toMatch(/reservations system/i);
  });

  it("Link owns the model outright when standalone", () => {
    expect(linkAuthority("standalone")).toMatchObject({ canEditModel: true, transient: false, note: null });
  });

  it("the CRS always owns it", () => {
    expect(crsAuthority()).toMatchObject({ canEditModel: true, canEditValues: true, transient: false });
  });
});

describe("rate VALUES stay editable in Link, and revert visibly", () => {
  it("are editable even when a CRS is connected", () => {
    // Blocking them makes Link useless to the hotels that live in it.
    expect(linkAuthority("crs_linked").canEditValues).toBe(true);
  });

  it("are marked transient, with copy saying so before the edit", () => {
    const a = linkAuthority("crs_linked");
    expect(a.transient).toBe(true);
    expect(a.note).toMatch(/may be replaced/i);
  });

  it("are NOT transient when standalone — nothing upstream reverts them", () => {
    expect(linkAuthority("standalone").transient).toBe(false);
  });
});

describe("findDivergences", () => {
  const link = [
    { roomTypeId: "r1", ratePlanId: "p1", date: "2026-09-01", occupancy: 2, minor: 11000 },
    { roomTypeId: "r1", ratePlanId: "p1", date: "2026-09-02", occupancy: 2, minor: 12000 },
  ];

  it("finds only the cells that actually differ", () => {
    const found = findDivergences(link, (_r, _p, d) => (d === "2026-09-01" ? 12500 : 12000));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ date: "2026-09-01", linkMinor: 11000, crsMinor: 12500 });
  });

  it("ignores a cell the CRS has no opinion about", () => {
    // No CRS value is not a disagreement — Link's number stands.
    expect(findDivergences(link, () => null)).toHaveLength(0);
  });

  it("is computed BEFORE the push, so the notice can name what changed", () => {
    const found = findDivergences(link, () => 9900);
    expect(divergenceNote(found[0]!)).toMatch(/changed here to €110\.00, replaced with €99\.00/);
    expect(divergenceNote(found[0]!)).toMatch(/owns this rate/);
  });
});

describe("the reassertion must re-push", () => {
  it("requires a push whenever anything diverged", () => {
    // Requirement 3, and the one most easily forgotten. Correcting the database and stopping leaves
    // the CRS and Link agreeing while the OTA still sells the Link value — and both internal
    // screens look right, which is what makes it hard to spot.
    const found = findDivergences(
      [{ roomTypeId: "r", ratePlanId: "p", date: "2026-09-01", occupancy: 2, minor: 100 }],
      () => 200,
    );
    expect(reassertionNeedsPush(found)).toBe(true);
  });

  it("requires nothing when nothing diverged", () => {
    expect(reassertionNeedsPush([])).toBe(false);
  });
});
