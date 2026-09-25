import { describe, expect, it } from "vitest";
import { FORECAST_DISCLAIMER } from "../format";
import { reports } from "./reports";

/** Sentences the Analytics screen shares with other English sources, held word for word. */
describe("Analytics English matches its sources", () => {
  it("forecast disclaimer is the Dashboard's, word for word", () => {
    expect(reports.en.otb.disclaimer).toBe(FORECAST_DISCLAIMER);
  });
  it("cancellation basis matches getCancellationReport's basisLabel wording", () => {
    // lib/metrics.ts builds these inline; the report now words them itself by lens.
    expect(reports.en.cancel.basis("book", 1)).toBe("of 1 reservation created in this period");
    expect(reports.en.cancel.basis("stay", 3)).toBe("of 3 stays falling in this period");
  });
});
