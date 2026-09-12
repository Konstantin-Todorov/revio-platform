import { describe, expect, it } from "vitest";
import { pullSummary } from "./sync.js";

/**
 * What a pull is allowed to claim.
 *
 * On 2026-09-12 a real Booking.com reservation for Cabacum Beach Residence reached Channex and never
 * reached Revio. The poller was alive and working — `channex-pull` had run 209 seconds earlier. The
 * booking arrived, its room and rate were not mapped for the channel, and the import branch that
 * handles that case ended with **`imported++`**.
 *
 * So the Sync Center recorded `Pulled 1 revisions (1 new · 0 updated · 0 unchanged)`, status
 * `success`, for a booking that had landed as a `failed_import` placeholder with no room, no dates
 * and no nights — nothing any screen could show. The founder's report was the only symptom the
 * software offered: *"it doesn't get pushed into our software anywhere"*.
 *
 * The rule pinned here: **a count that cannot express failure will report success.**
 */

const pull = (o: Partial<Parameters<typeof pullSummary>[0]> = {}) =>
  pullSummary({
    channelName: "Channex", revisions: 0, imported: 0, updated: 0, unchanged: 0,
    failedImport: 0, useFeed: true, ...o,
  });

describe("a pull that rejected a booking", () => {
  /* THE case. One booking in, none landed, and the log used to read "1 new · success". */
  it("is never reported as success", () => {
    expect(pull({ revisions: 1, failedImport: 1 }).status).toBe("warning");
  });

  it("names the rejection in the summary, where somebody would read it", () => {
    const { summary } = pull({ revisions: 1, failedImport: 1 });
    expect(summary).toMatch(/1 could not be imported/);
    // And it must NOT claim the booking as new — that is the exact line that was wrong.
    expect(summary).toMatch(/0 new/);
  });

  it("counts a rejected booking apart from an imported one", () => {
    const { summary } = pull({ revisions: 3, imported: 2, failedImport: 1 });
    expect(summary).toMatch(/2 new/);
    expect(summary).toMatch(/1 could not be imported/);
  });
});

describe("a pull that worked", () => {
  it("stays success and says nothing about rejections", () => {
    const { status, summary } = pull({ revisions: 2, imported: 2 });
    expect(status).toBe("success");
    expect(summary).not.toMatch(/could not be imported/);
  });

  it("reports a genuinely quiet feed as success", () => {
    // The normal case, and it has to stay quiet — a poller that cried wolf every few minutes would
    // train everybody to ignore the one run that mattered.
    expect(pull().status).toBe("success");
    expect(pull().summary).toMatch(/Pulled 0 revisions/);
  });
});
