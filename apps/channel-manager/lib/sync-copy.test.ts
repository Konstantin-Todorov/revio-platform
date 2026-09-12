import { describe, expect, it } from "vitest";
import { syncCadence } from "@revio/core";
import { pullSummary, pushVerdict } from "@revio/connectivity";

/**
 * The words a hotelier reads on the Sync Center when something is wrong.
 *
 * Pinned together because they are one conversation, and because every one of them was previously
 * either absent or a lie: pushes reported success with no channel, rejected bookings were counted as
 * imported, the explanations were written to a `detail` column nothing rendered, and no screen said
 * when any of it happens.
 */

describe("a hotel whose channel is not mapped yet", () => {
  it("is told what to do, not that everything is fine", () => {
    const push = pushVerdict({ attempted: 1, delivered: 0, failed: 0, paused: false, unmapped: ["Booking.com"] });
    expect(push.status).toBe("warning");
    expect(push.detail).toMatch(/Map the room types and rate plans in Mapping/);
  });

  it("is told when a booking arrived and bounced", () => {
    const pull = pullSummary({
      channelName: "Channex", revisions: 1, imported: 0, updated: 0, unchanged: 0,
      failedImport: 1, useFeed: true,
    });
    expect(pull.status).toBe("warning");
    expect(pull.summary).toMatch(/1 could not be imported/);
  });
});

describe("a hotel wondering whether to wait", () => {
  it("is told bookings come on their own, and that saving sends immediately", () => {
    const c = syncCadence({ lastSyncAt: new Date("2026-09-12T11:58:00Z"), now: new Date("2026-09-12T12:00:00Z") });
    expect(c.sentence).toMatch(/within about 5 minutes/);
    expect(c.sentence).toMatch(/sent the moment you save them/);
  });

  it("stops blaming the timer once it is genuinely late", () => {
    const c = syncCadence({ lastSyncAt: new Date("2026-09-12T11:40:00Z"), now: new Date("2026-09-12T12:00:00Z") });
    expect(c.overdue).toBe(true);
    expect(c.sentence).toMatch(/check this channel's connection/);
  });
});

describe("the three verdicts stay distinguishable", () => {
  it("never uses the same status for delivered, undelivered and failed", () => {
    const delivered = pushVerdict({ attempted: 1, delivered: 1, failed: 0, paused: false, unmapped: [] }).status;
    const undelivered = pushVerdict({ attempted: 1, delivered: 0, failed: 0, paused: false, unmapped: ["X"] }).status;
    const failed = pushVerdict({ attempted: 1, delivered: 0, failed: 1, paused: false, unmapped: [] }).status;
    expect(new Set([delivered, undelivered, failed]).size).toBe(3);
  });
});
