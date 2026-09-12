import { describe, expect, it } from "vitest";
import { PULL_INTERVAL_MINUTES, syncCadence } from "./cadence.js";

/**
 * "When do these pushes and pulls happen, and do I have to wait?" — the founder, 2026-09-12, after a
 * real Booking.com reservation did not appear as fast as expected.
 *
 * Nothing on any screen answered it. The answers are pinned here because they are load-bearing: a
 * hotelier who does not know bookings arrive within five minutes cannot tell "not yet" from
 * "broken", and will either ring us or, worse, stop trusting the screen.
 */

const at = (iso: string) => new Date(iso);
const NOW = at("2026-09-12T12:00:00Z");

describe("what the screen tells a hotelier", () => {
  it("says bookings arrive on their own, and how soon", () => {
    const c = syncCadence({ lastSyncAt: at("2026-09-12T11:58:00Z"), now: NOW });
    expect(c.sentence).toMatch(/arrive on their own, within about 5 minutes/);
    expect(c.lastLabel).toBe("2 minutes ago");
  });

  /*
   * The half people get wrong in the other direction: they wait for a price change to "sync". It
   * already has — `syncRealChannels` runs inside the same request that saved it.
   */
  it("says what you SEND is immediate", () => {
    const c = syncCadence({ lastSyncAt: at("2026-09-12T11:58:00Z"), now: NOW });
    expect(c.sentence).toMatch(/sent the moment you save them/);
  });

  it("counts down to the next collection", () => {
    expect(syncCadence({ lastSyncAt: at("2026-09-12T11:57:00Z"), now: NOW }).nextLabel).toBe("in about 2 minutes");
    expect(syncCadence({ lastSyncAt: at("2026-09-12T11:59:45Z"), now: NOW }).nextLabel).toBe("in about 5 minutes");
  });

  it("says 'any moment now' rather than a countdown that has run out", () => {
    // A "0 minutes" or a negative number reads as broken. This is the ordinary case at the end of
    // every cycle, and it has to read as normal.
    expect(syncCadence({ lastSyncAt: at("2026-09-12T11:55:10Z"), now: NOW }).nextLabel).toBe("any moment now");
  });
});

describe("when it is genuinely late", () => {
  /*
   * ⚠️ TWO intervals, not one. A tick landing a few seconds late is normal; flagging that is how a
   * status light becomes something people ignore.
   */
  it("tolerates one missed beat", () => {
    const c = syncCadence({ lastSyncAt: at("2026-09-12T11:52:00Z"), now: NOW }); // 8 min, interval 5
    expect(c.overdue).toBe(false);
  });

  it("flags two missed cycles, and stops blaming the timer", () => {
    const c = syncCadence({ lastSyncAt: at("2026-09-12T11:45:00Z"), now: NOW }); // 15 min
    expect(c.overdue).toBe(true);
    expect(c.sentence).toMatch(/longer than it should be/);
    expect(c.nextLabel).toBe("overdue");
  });

  it("does not pretend a channel that never synced is overdue", () => {
    // Never having run is a setup state, not a fault, and saying "overdue" would send somebody
    // looking for a broken connection that was never made.
    const c = syncCadence({ lastSyncAt: null, now: NOW });
    expect(c.overdue).toBe(false);
    expect(c.lastLabel).toBe("never");
    expect(c.nextLabel).toBeNull();
    expect(c.sentence).toMatch(/has not collected any yet/);
  });
});

describe("the interval is not invented here", () => {
  it("matches the scheduler", () => {
    // `instrumentation.ts` ticks /api/jobs/pull on FIVE_MINUTES. If that changes and this does not,
    // every screen quoting this number starts lying.
    expect(PULL_INTERVAL_MINUTES).toBe(5);
  });

  it("can be told a different interval without rewriting the copy", () => {
    expect(syncCadence({ lastSyncAt: at("2026-09-12T11:50:00Z"), now: NOW, intervalMinutes: 15 }).sentence)
      .toMatch(/within about 15 minutes/);
  });
});
