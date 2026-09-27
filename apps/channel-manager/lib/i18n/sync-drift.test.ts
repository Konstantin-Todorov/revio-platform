import { describe, expect, it } from "vitest";
import { syncCadence } from "@revio/core";
import { sync, sayCadence } from "./sync";

/** Core's `syncCadence` sentence, worded by RevioLink — the English must stay word for word core's. */
describe("sync cadence matches core, in English", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  it("never collected, and every age from seconds to days", () => {
    expect(sayCadence(sync.en, null, now).sentence).toBe(syncCadence({ lastSyncAt: null, now }).sentence);
    for (const secs of [5, 45, 61, 150, 260, 299, 330, 601, 3_700, 7_300, 90_000, 200_000]) {
      const last = new Date(now.getTime() - secs * 1000);
      const core = syncCadence({ lastSyncAt: last, now });
      const ours = sayCadence(sync.en, last, now);
      expect(ours.sentence).toBe(core.sentence);
      expect(ours.overdue).toBe(core.overdue);
    }
  });
});
