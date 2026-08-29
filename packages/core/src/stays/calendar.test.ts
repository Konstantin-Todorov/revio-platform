import { describe, it, expect } from "vitest";
import { addDays, monthGrid, nightsBetween, parseISO, toISO, isValidISO, WEEKDAYS } from "./calendar.js";

describe("monthGrid", () => {
  it("is Monday-first, with leading blanks so the 1st lands under its weekday", () => {
    // 1 Sep 2026 is a Tuesday, so one blank then the 1st.
    const cells = monthGrid(2026, 8);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-09-01");
    expect(WEEKDAYS).toHaveLength(7);
  });

  it("puts a Sunday 1st at the END of the first row, not the start", () => {
    // The bug a Sunday-first grid produces. 1 Feb 2026 is a Sunday: six blanks precede it.
    const cells = monthGrid(2026, 1);
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]).toBe("2026-02-01");
  });

  it("omits trailing blanks rather than padding a dead final row", () => {
    const cells = monthGrid(2026, 8);
    expect(cells[cells.length - 1]).toBe("2026-09-30");
  });

  it("gets February right in a leap year", () => {
    expect(monthGrid(2028, 1).filter(Boolean)).toHaveLength(29);
    expect(monthGrid(2026, 1).filter(Boolean)).toHaveLength(28);
  });
});

describe("stay arithmetic", () => {
  it("counts nights, not days", () => {
    // Two dates one apart is ONE night. Off-by-one here misprices every stay.
    expect(nightsBetween("2026-09-01", "2026-09-02")).toBe(1);
    expect(nightsBetween("2026-09-01", "2026-09-05")).toBe(4);
  });

  it("never returns a negative night count", () => {
    expect(nightsBetween("2026-09-05", "2026-09-01")).toBe(0);
  });

  it("same day is zero nights", () => {
    expect(nightsBetween("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("survives a DST boundary — the reason the maths is UTC-anchored", () => {
    // Europe/Sofia moves on 25 Oct 2026. In local time this span loses or gains an hour and a
    // naive implementation reports 30 or 32 nights.
    expect(nightsBetween("2026-10-11", "2026-11-11")).toBe(31);
  });

  it("addDays crosses a month and a year boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("isValidISO", () => {
  it("accepts a real calendar date", () => {
    expect(isValidISO("2026-09-01")).toBe(true);
  });
  it("rejects junk, empty and the wrong shape", () => {
    for (const v of [null, undefined, "", "01/09/2026", "2026-9-1", "not-a-date"]) {
      expect(isValidISO(v)).toBe(false);
    }
  });
});

describe("toISO uses the LOCAL calendar", () => {
  it("reports the local date, so nobody is told they are booking yesterday", () => {
    // The rule in the file header: a guest in UTC+3 at 01:00 is on tomorrow's date locally, and
    // formatting via UTC would hand them yesterday.
    const d = new Date(2026, 8, 1, 1, 0, 0);
    expect(toISO(d)).toBe("2026-09-01");
  });
  it("round-trips through parseISO for arithmetic", () => {
    expect(parseISO("2026-09-01").toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});
