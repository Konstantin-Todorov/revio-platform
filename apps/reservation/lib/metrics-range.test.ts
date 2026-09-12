import { describe, expect, it } from "vitest";
import { buildActionAlerts, comparisonRange, resolveRange, stlyRange } from "./metrics";

/**
 * The date arithmetic behind every number RevioCRS reports, and the Action Center that decides what
 * a manager sees first.
 *
 * RevioCRS had no test runner at all until 2026-09-12 — `pnpm verify` and CI had never run one test
 * for this app, and said nothing about it. These four functions are where that mattered most: they
 * are pure, they are wrong in ways nobody can see, and everything downstream inherits it. A
 * comparison range one day out does not break a screen — it quietly reports last Friday's business
 * as last Saturday's, and a hotelier prices a weekend against a weekday.
 *
 * `2026-09-12` is a Saturday. Every weekday assertion below depends on that.
 */

const SATURDAY = "2026-09-12";
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday, 6 = Saturday

describe("the comparison ranges — the ones that are silently wrong", () => {
  /*
   * THE rule, and the reason it is 364 rather than 365.
   *
   * A hotel's week is not interchangeable: Saturday is not Tuesday, and a year-on-year figure that
   * compares them is worse than none, because it looks authoritative. 364 days is exactly 52 weeks,
   * so the weekday survives the shift. 365 would slide it by one and every YoY number on the
   * platform would compare the wrong kind of day.
   */
  it("shifts STLY by 364 days so a Saturday compares to a Saturday", () => {
    const range = resolveRange(SATURDAY, "l7d");
    const stly = stlyRange(range);
    expect(dow(SATURDAY)).toBe(6);
    expect(dow(stly.start)).toBe(dow(range.start));
    expect(dow(stly.endExcl)).toBe(dow(range.endExcl));

    const daysBack = (new Date(`${range.start}T00:00:00Z`).getTime() - new Date(`${stly.start}T00:00:00Z`).getTime()) / 86_400_000;
    expect(daysBack).toBe(364);
  });

  it("keeps the window the same length when it shifts it", () => {
    // A comparison against a window of a different size is not a comparison.
    for (const preset of ["l7d", "l28d", "n7d", "n28d", "today"]) {
      const range = resolveRange(SATURDAY, preset);
      for (const shifted of [stlyRange(range), comparisonRange(range, "yoy"), comparisonRange(range, "lw")]) {
        expect(shifted.days, `${preset}`).toBe(range.days);
      }
    }
  });

  it("uses 364 for year-on-year and 7 for last week, both weekday-aligned", () => {
    const range = resolveRange(SATURDAY, "l7d");
    const back = (a: string, b: string) =>
      (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000;

    expect(back(range.start, comparisonRange(range, "yoy").start)).toBe(364);
    expect(back(range.start, comparisonRange(range, "lw").start)).toBe(7);
    expect(dow(comparisonRange(range, "lw").start)).toBe(dow(range.start));
  });

  it("says which baseline it is, so two numbers on a screen cannot be confused", () => {
    const range = resolveRange(SATURDAY, "l28d");
    expect(comparisonRange(range, "yoy").label).toMatch(/STLY$/);
    expect(comparisonRange(range, "lw").label).toMatch(/LW$/);
  });
});

describe("what each preset actually covers", () => {
  it("treats 'last 7 days' as the 7 days BEFORE today, not including today", () => {
    // Today is incomplete. Including it drags every average down all morning.
    const r = resolveRange(SATURDAY, "l7d");
    expect(r).toMatchObject({ start: "2026-09-05", endExcl: SATURDAY, days: 7, kind: "past" });
  });

  it("treats 'next 7 days' as starting today, because tonight is still sellable", () => {
    const r = resolveRange(SATURDAY, "n7d");
    expect(r).toMatchObject({ start: SATURDAY, endExcl: "2026-09-19", days: 7, kind: "future" });
  });

  it("includes today in month- and year-to-date", () => {
    expect(resolveRange(SATURDAY, "mtd")).toMatchObject({ start: "2026-09-01", endExcl: "2026-09-13" });
    expect(resolveRange(SATURDAY, "ytd")).toMatchObject({ start: "2026-01-01", endExcl: "2026-09-13" });
  });

  /*
   * `preset` is what the screens put back into the URL and what highlights the active button. MTD
   * used to return the YTD preset — right dates, wrong identity — so following a link built from a
   * Month-to-date view silently widened it to the whole year.
   */
  it("gives month-to-date its own identity, not year-to-date's", () => {
    expect(resolveRange(SATURDAY, "mtd").preset).toBe("mtd");
    expect(resolveRange(SATURDAY, "mtd").label).toBe("Month to date");
  });

  it("classifies a range spanning today as mixed, not past or future", () => {
    // The labels change on this: a past range reports ACTUALS, a future one ON-THE-BOOKS.
    const r = resolveRange(SATURDAY, "custom", "2026-09-10", "2026-09-20");
    expect(r.kind).toBe("mixed");
    expect(resolveRange(SATURDAY, "custom", "2026-09-01", "2026-09-11").kind).toBe("past");
    expect(resolveRange(SATURDAY, "custom", "2026-09-13", "2026-09-20").kind).toBe("future");
  });
});

describe("a custom range it cannot honour", () => {
  /*
   * ⚠️ Every one of these SILENTLY becomes "Today" — the screen answers a different question from
   * the one asked, with no message. Pinned rather than changed: the fallback is safe, and a report
   * that refuses is worse than one that narrows. But it must not be able to change without somebody
   * deciding to.
   */
  it("falls back to today for a reversed, malformed or over-long range", () => {
    for (const [from, to, why] of [
      ["2026-09-20", "2026-09-10", "end before start"],
      ["not-a-date", "2026-09-20", "malformed"],
      ["2024-01-01", "2026-09-12", "longer than 366 days"],
      ["", "", "empty"],
    ] as const) {
      const r = resolveRange(SATURDAY, "custom", from, to);
      expect(r.preset, why).toBe("today");
      expect(r.days, why).toBe(1);
    }
  });

  it("accepts a range of exactly 366 days, the documented ceiling", () => {
    // Boundary, because a leap year is a legitimate twelve months and an off-by-one here would
    // reject it while accepting 365.
    const r = resolveRange(SATURDAY, "custom", "2025-09-12", "2026-09-11");
    expect(r.preset).toBe("custom");
    expect(r.days).toBe(365);
  });

  it("falls back to today for an unknown preset rather than throwing", () => {
    expect(resolveRange(SATURDAY, "last-decade").preset).toBe("today");
    expect(resolveRange(SATURDAY).preset).toBe("today");
  });
});

describe("the Action Center — what a manager is shown first", () => {
  const board = (remaining: number[][], names = ["Apartment 3BR", "Apartment 1BR"]) => ({
    dates: ["2026-09-12", "2026-09-13", "2026-09-14"],
    sections: remaining.map((cells, i) => ({
      roomType: { name: names[i] ?? `Room ${i}` },
      cells: cells.map((r) => ({ remaining: r })),
    })),
  });

  it("puts an overbooking above a sell-out, and a sell-out above a low count", () => {
    // Severity is how soon somebody must act, and the order is the whole value of the panel.
    const alerts = buildActionAlerts({
      board: board([[5, 0, -2]]), threshold: 3, failedSyncs24h: 0, openErrors: 0,
    });
    expect(alerts.map((a) => a.severity)).toEqual(["critical", "warning"]);
    expect(alerts[0]!.message).toMatch(/OVERBOOKED by 2 on 2026-09-14/);
    expect(alerts[1]!.message).toMatch(/sells out on 2026-09-13/);
  });

  it("says nothing about a room with comfortable availability", () => {
    // A panel that always has something in it is a panel nobody reads.
    expect(buildActionAlerts({ board: board([[9, 9, 9]]), threshold: 3, failedSyncs24h: 0, openErrors: 0 })).toEqual([]);
  });

  it("counts the threshold as inclusive", () => {
    // "only 3 left" with a threshold of 3 is the case somebody set the threshold FOR.
    const alerts = buildActionAlerts({ board: board([[3, 9, 9]]), threshold: 3, failedSyncs24h: 0, openErrors: 0 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.message).toMatch(/only 3 left/);
  });

  it("never lets a full board push a failed sync off the list", () => {
    /*
     * ⚠️ The list is capped at 10. A property with dozens of low-availability dates would fill it
     * entirely — and a failed sync is the alert that means the hotel is selling blind. Severity
     * sorting is what protects it, so it is asserted rather than assumed.
     */
    const busy = board([Array.from({ length: 40 }, () => 1)]);
    busy.dates = Array.from({ length: 40 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const alerts = buildActionAlerts({ board: busy, threshold: 3, failedSyncs24h: 2, openErrors: 1 });

    expect(alerts).toHaveLength(10);
    expect(alerts[0]!.message).toMatch(/2 failed syncs in the last 24h/);
    expect(alerts.some((a) => a.message.match(/1 unresolved error/))).toBe(true);
  });

  it("gets the singular and plural right, because these are read at a glance", () => {
    const one = buildActionAlerts({ board: board([[9]]), threshold: 1, failedSyncs24h: 1, openErrors: 1 });
    expect(one.map((a) => a.message)).toEqual([
      "1 failed sync in the last 24h",
      "1 unresolved error needs attention",
    ]);
  });

  it("links every alert to the date it is about", () => {
    // An alert you have to go hunting for is an alert that gets ignored.
    const alerts = buildActionAlerts({ board: board([[0]]), threshold: 3, failedSyncs24h: 0, openErrors: 0 });
    expect(alerts[0]!.href).toBe("/inventory?start=2026-09-12&days=7");
  });
});
