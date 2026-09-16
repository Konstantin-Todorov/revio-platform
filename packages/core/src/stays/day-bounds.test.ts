import { describe, expect, it } from "vitest";

import { dayBoundsInTimeZone, todayInTimeZone } from "./past-dates";

const iso = (d: Date) => d.toISOString();

describe("dayBoundsInTimeZone", () => {
  it("starts the day at local midnight, not UTC midnight", () => {
    // Sofia is UTC+3 in summer, so 17 Sep begins at 21:00 UTC on the 16th.
    const { start, next } = dayBoundsInTimeZone("2026-09-17", "Europe/Sofia");
    expect(iso(start)).toBe("2026-09-16T21:00:00.000Z");
    expect(iso(next)).toBe("2026-09-17T21:00:00.000Z");
  });

  it("⚠️ puts a 01:00 Sofia booking in TODAY, which is the bug it exists for", () => {
    // 01:00 on the 17th in Sofia is 22:00 UTC on the 16th. Bucketed by the server's day that lands
    // in "yesterday" — and 00:00–03:00 is the night auditor's shift, when somebody is reading it.
    const bookedAt = new Date("2026-09-16T22:00:00.000Z");
    const { start, next } = dayBoundsInTimeZone("2026-09-17", "Europe/Sofia");
    expect(bookedAt >= start && bookedAt < next).toBe(true);

    // The old shape, for contrast: it would have excluded it.
    const utcStart = new Date("2026-09-17T00:00:00.000Z");
    expect(bookedAt >= utcStart).toBe(false);
  });

  it("is exactly 24h apart on an ordinary day", () => {
    const { start, next } = dayBoundsInTimeZone("2026-06-15", "Europe/Sofia");
    expect(next.getTime() - start.getTime()).toBe(86_400_000);
  });

  it("handles the night the clocks go back — a 25-hour day", () => {
    // EU DST ends on the last Sunday of October; in 2026 that is the 25th. Sofia goes +3 → +2.
    const { start, next } = dayBoundsInTimeZone("2026-10-25", "Europe/Sofia");
    expect(iso(start)).toBe("2026-10-24T21:00:00.000Z");
    expect(next.getTime() - start.getTime()).toBe(25 * 3_600_000);
  });

  it("handles the night the clocks go forward — a 23-hour day", () => {
    // Last Sunday of March 2026 is the 29th. Sofia goes +2 → +3.
    const { start, next } = dayBoundsInTimeZone("2026-03-29", "Europe/Sofia");
    expect(iso(start)).toBe("2026-03-28T22:00:00.000Z");
    expect(next.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });

  it("works for a zone behind UTC too", () => {
    const { start } = dayBoundsInTimeZone("2026-09-17", "America/New_York");
    expect(iso(start)).toBe("2026-09-17T04:00:00.000Z");
  });

  it("is UTC midnight for UTC, which is the only case the old code got right", () => {
    const { start, next } = dayBoundsInTimeZone("2026-09-17", "UTC");
    expect(iso(start)).toBe("2026-09-17T00:00:00.000Z");
    expect(iso(next)).toBe("2026-09-18T00:00:00.000Z");
  });

  it("agrees with todayInTimeZone: now always falls inside today's bounds", () => {
    for (const tz of ["Europe/Sofia", "America/New_York", "Asia/Tokyo", "UTC"]) {
      const now = new Date();
      const { start, next } = dayBoundsInTimeZone(todayInTimeZone(tz, now), tz);
      expect(now >= start && now < next, `${tz}`).toBe(true);
    }
  });
});
