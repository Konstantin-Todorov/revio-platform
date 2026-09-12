import { describe, it, expect } from "vitest";
import {
  earliestSelectable, futureDateRefusal, pastDateRefusal, pastRangeRefusal, todayInTimeZone,
} from "./past-dates.js";

describe("todayInTimeZone", () => {
  it("returns the property's calendar date, not the server's", () => {
    // 01:00 in Sofia is 22:00 UTC the day before. This is the whole defect: for the first three
    // hours of every Bulgarian day — the night auditor's shift — a UTC-derived "today" is
    // yesterday, so a screen defaults to a date it would then refuse.
    const now = new Date("2026-09-13T01:00:00+03:00");
    expect(todayInTimeZone("Europe/Sofia", now)).toBe("2026-09-13");
    expect(now.toISOString().slice(0, 10)).toBe("2026-09-12"); // what the code used to do
  });

  it("holds in the other direction too", () => {
    // 23:00 in Los Angeles is 06:00 UTC tomorrow — a UTC "today" runs a day AHEAD there.
    const now = new Date("2026-09-12T23:00:00-07:00");
    expect(todayInTimeZone("America/Los_Angeles", now)).toBe("2026-09-12");
    expect(now.toISOString().slice(0, 10)).toBe("2026-09-13");
  });

  it("is stable across a DST boundary", () => {
    // Sofia leaves DST on 25 Oct 2026; 03:30 local happens twice. Both are the same calendar date,
    // which is all a date field needs to know.
    expect(todayInTimeZone("Europe/Sofia", new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    expect(todayInTimeZone("Europe/Sofia", new Date("2026-10-25T01:30:00Z"))).toBe("2026-10-25");
  });
});

describe("earliestSelectable", () => {
  const TODAY = "2026-09-13";

  it("forward-only: the floor is today", () => {
    expect(earliestSelectable(TODAY)).toBe(TODAY);
    expect(earliestSelectable(TODAY, null)).toBe(TODAY);
  });

  it("keep-existing: a date already in the past stays reachable", () => {
    // The guest checked in on Tuesday. That is a fact, not a mistake, and editing their departure
    // must not force their arrival forward.
    expect(earliestSelectable(TODAY, "2026-09-08")).toBe("2026-09-08");
  });

  it("keep-existing never OPENS the past beyond where the record already is", () => {
    const floor = earliestSelectable(TODAY, "2026-09-08");
    // You may leave it where it is; you may not move it earlier still.
    expect(pastDateRefusal({ label: "Arrival", iso: "2026-09-08", earliest: floor })).toBeNull();
    expect(pastDateRefusal({ label: "Arrival", iso: "2026-09-07", earliest: floor })).not.toBeNull();
  });

  it("a future existing value does not push the floor forward", () => {
    // A booking for next month can still be moved to today.
    expect(earliestSelectable(TODAY, "2026-10-01")).toBe(TODAY);
  });
});

describe("pastDateRefusal", () => {
  const EARLIEST = "2026-09-13";

  it("passes today and everything after it", () => {
    expect(pastDateRefusal({ label: "The start date", iso: "2026-09-13", earliest: EARLIEST })).toBeNull();
    expect(pastDateRefusal({ label: "The start date", iso: "2027-01-01", earliest: EARLIEST })).toBeNull();
  });

  it("refuses yesterday and says what to do instead", () => {
    const msg = pastDateRefusal({ label: "The start date", iso: "2026-09-12", earliest: EARLIEST });
    expect(msg).toContain("has already passed");
    // An error that does not say the way out is half an error (docs/UI-STANDARD.md).
    expect(msg).toContain("earliest you can pick");
    expect(msg).toContain("Sun 13 Sep");
  });

  it("leads with the date when the field has no name worth saying", () => {
    // A calendar cell IS a date; "That night of Thu 10 Sept has already passed" invents a noun to
    // hang the date on and reads worse than the date alone.
    const msg = pastDateRefusal({ iso: "2026-09-10", earliest: EARLIEST });
    expect(msg).toMatch(/^Thu 10 Sept has already passed/);
  });

  it("says nothing about an empty field — that is the required-field check's job", () => {
    expect(pastDateRefusal({ label: "The start date", iso: "", earliest: EARLIEST })).toBeNull();
  });
});

describe("pastRangeRefusal", () => {
  const EARLIEST = "2026-09-13";

  it("clears a range that starts today", () => {
    expect(pastRangeRefusal({ from: "2026-09-13", to: "2026-09-20", earliest: EARLIEST })).toBeNull();
  });

  it("reports the START first when both ends are in the past", () => {
    // Reading order: fix the first problem, re-submit, see the second. Reporting the end first
    // sends the reader to the wrong field.
    const msg = pastRangeRefusal({ from: "2026-09-01", to: "2026-09-05", earliest: EARLIEST });
    expect(msg).toContain("The start date");
    expect(msg).not.toContain("The end date");
  });

  it("catches a past end date under a valid start", () => {
    const msg = pastRangeRefusal({ from: "2026-09-13", to: "2026-09-01", earliest: EARLIEST });
    expect(msg).toContain("The end date");
  });

  it("takes the field names the screen uses", () => {
    const msg = pastRangeRefusal({
      from: "2026-09-01", to: "2026-09-20", earliest: EARLIEST,
      fromLabel: "Arrival", toLabel: "Departure",
    });
    expect(msg).toContain("Arrival");
  });
});

describe("futureDateRefusal", () => {
  it("lets any past date through — that is the point of a birth date", () => {
    expect(futureDateRefusal({ label: "Date of birth", iso: "1974-03-02", today: "2026-09-13" })).toBeNull();
    expect(futureDateRefusal({ label: "Date of birth", iso: "2026-09-13", today: "2026-09-13" })).toBeNull();
  });

  it("refuses a date of birth in the future", () => {
    const msg = futureDateRefusal({ label: "Date of birth", iso: "2026-09-14", today: "2026-09-13" });
    expect(msg).toContain("is in the future");
  });
});
