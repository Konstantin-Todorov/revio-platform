import { describe, expect, it } from "vitest";
import { pushVerdict, type RealPushOutcome } from "./sync.js";

/**
 * What a push event is allowed to claim.
 *
 * BUG-014, reported from Cabacum Beach Residence on 2026-09-12 and correctly identified there as the
 * one to fix first: the Sync Center showed *"0 errors · everything is syncing cleanly"* and a log of
 * green `success` rows on a property where **no price had ever reached a channel**. It masked the
 * other thirteen defects, because no fix to any of them could be told apart from the failure.
 *
 * The verdict function is pinned here rather than left inside a server action, because the rule —
 * *`success` means a channel accepted something* — is the whole fix, and it is one edit away from
 * quietly becoming "success means we tried" again.
 */

const outcome = (o: Partial<RealPushOutcome> = {}): RealPushOutcome => ({
  attempted: 0, delivered: 0, failed: 0, paused: false, unmapped: [], ...o,
});

describe("success has to be earned", () => {
  it("is success only when a channel accepted something", () => {
    expect(pushVerdict(outcome({ attempted: 1, delivered: 1 })).status).toBe("success");
  });

  /*
   * THE reported row: a push with `CHANNEL = —` and status success, written before anything was
   * attempted. Every state below used to produce exactly that.
   */
  it("is never success when nothing was delivered", () => {
    for (const o of [
      outcome(),
      outcome({ paused: true }),
      outcome({ attempted: 1, unmapped: ["Booking.com"] }),
      outcome({ attempted: 1, failed: 1 }),
      outcome({ attempted: 3, failed: 3 }),
    ]) {
      expect(pushVerdict(o).status, JSON.stringify(o)).not.toBe("success");
      expect(pushVerdict(o).delivered).toBe(false);
    }
  });

  it("tells a hotel with nothing mapped apart from one whose push failed", () => {
    // Different problems, different fixes: one is a screen to finish, the other is an error to read.
    expect(pushVerdict(outcome({ attempted: 1, unmapped: ["Booking.com"] })).status).toBe("warning");
    expect(pushVerdict(outcome({ attempted: 1, failed: 1 })).status).toBe("failed");
  });

  it("calls a paused connection skipped, not failed", () => {
    // Distribution being off on purpose is not a fault, and reporting it as one trains people to
    // ignore the column.
    expect(pushVerdict(outcome({ paused: true })).status).toBe("skipped");
  });

  it("calls a property with no channel a no-op, not a success", () => {
    // The exact state the old code called success: nothing to send to, so nothing was sent.
    expect(pushVerdict(outcome()).status).toBe("noop");
  });

  it("reports delivery even when some channels failed alongside", () => {
    // Partial delivery is still delivery; the failing channel records its own error.
    expect(pushVerdict(outcome({ attempted: 2, delivered: 1, failed: 1 })).status).toBe("success");
  });
});
