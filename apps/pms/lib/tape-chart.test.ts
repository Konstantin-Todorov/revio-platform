import { describe, expect, it } from "vitest";

import { barSpan } from "./tape-chart";

/**
 * The calendar's date maths, which had no tests until a stay reported the wrong length on screen.
 *
 * The bug: `nights` was computed from the CLIPPED window, and the stay dialog printed it beside the
 * UNCLIPPED dates. A four-night stay whose first two nights sat before the visible window read
 * "2026-09-14 → 2026-09-18 · 2 nights", and scrolling the calendar changed the number.
 *
 * The rule these tests hold: `from`/`to`/`columns` are drawing and may be clipped; `stayNights` is a
 * fact about the booking and may not.
 */

const WIN_FROM = "2026-09-16";
const WIN_TO = "2026-09-29"; // a 14-day window

describe("barSpan", () => {
  it("counts nights from the stay, not from what is on screen", () => {
    // The exact case found on production: check-in 14th, check-out 18th = 4 nights (14,15,16,17).
    const span = barSpan("2026-09-14", "2026-09-18", WIN_FROM, WIN_TO)!;
    expect(span.stayNights).toBe(4);
    // ...while only the 16th and 17th are visible, so the bar is 2 columns wide.
    expect(span.columns).toBe(2);
    expect(span.from).toBe("2026-09-16");
    expect(span.to).toBe("2026-09-17");
  });

  it("reports the same stay length wherever the window sits", () => {
    // Scrolling the calendar must not change how long somebody stayed. This is the regression.
    const lengths = [
      barSpan("2026-09-14", "2026-09-18", "2026-09-10", "2026-09-23"), // fully visible
      barSpan("2026-09-14", "2026-09-18", "2026-09-16", "2026-09-29"), // left edge cut
      barSpan("2026-09-14", "2026-09-18", "2026-09-01", "2026-09-15"), // right edge cut
      barSpan("2026-09-14", "2026-09-18", "2026-09-16", "2026-09-16"), // one column visible
    ].map((s) => s?.stayNights);
    expect(lengths).toEqual([4, 4, 4, 4]);
  });

  it("does not draw the departure day — it is sellable again", () => {
    // A 3→6 stay occupies the 3rd, 4th and 5th. Drawing through the 6th shows the room busy on a
    // night somebody else could have it.
    const span = barSpan("2026-08-03", "2026-08-06", "2026-08-01", "2026-08-10")!;
    expect(span.to).toBe("2026-08-05");
    expect(span.columns).toBe(3);
    expect(span.stayNights).toBe(3);
  });

  it("handles a one-night stay", () => {
    const span = barSpan("2026-09-20", "2026-09-21", WIN_FROM, WIN_TO)!;
    expect(span.stayNights).toBe(1);
    expect(span.columns).toBe(1);
    expect(span.from).toBe("2026-09-20");
    expect(span.to).toBe("2026-09-20");
  });

  it("marks which edge is cut so the bar can show it continues", () => {
    const left = barSpan("2026-09-10", "2026-09-20", WIN_FROM, WIN_TO)!;
    expect([left.continuesLeft, left.continuesRight]).toEqual([true, false]);

    const right = barSpan("2026-09-20", "2026-10-05", WIN_FROM, WIN_TO)!;
    expect([right.continuesLeft, right.continuesRight]).toEqual([false, true]);

    const both = barSpan("2026-09-01", "2026-10-05", WIN_FROM, WIN_TO)!;
    expect([both.continuesLeft, both.continuesRight]).toEqual([true, true]);
    expect(both.columns).toBe(14); // the whole window

    const neither = barSpan("2026-09-18", "2026-09-20", WIN_FROM, WIN_TO)!;
    expect([neither.continuesLeft, neither.continuesRight]).toEqual([false, false]);
  });

  it("returns null for a stay entirely outside the window", () => {
    expect(barSpan("2026-08-01", "2026-08-05", WIN_FROM, WIN_TO)).toBeNull();
    expect(barSpan("2026-11-01", "2026-11-05", WIN_FROM, WIN_TO)).toBeNull();
    // ⚠️ A stay that CHECKS OUT on the first visible day occupies no visible night — its last night
    // is the day before. Drawing it would put a bar on a day the room is free.
    expect(barSpan("2026-09-14", "2026-09-16", WIN_FROM, WIN_TO)).toBeNull();
  });

  it("includes a stay arriving on the last visible day", () => {
    const span = barSpan("2026-09-29", "2026-10-02", WIN_FROM, WIN_TO)!;
    expect(span.columns).toBe(1);
    expect(span.stayNights).toBe(3);
    expect(span.continuesRight).toBe(true);
  });

  it("counts across a month boundary", () => {
    // Date maths done on strings is where off-by-one lives; September has 30 days.
    const span = barSpan("2026-09-28", "2026-10-03", "2026-09-01", "2026-10-31")!;
    expect(span.stayNights).toBe(5);
    expect(span.to).toBe("2026-10-02");
  });
});
