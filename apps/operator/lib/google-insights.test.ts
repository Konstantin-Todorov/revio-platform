import { describe, expect, it } from "vitest";
import {
  delta, localeOf, parseGaDate, readConfig, shapePages, shapeQueries, shapeTraffic,
  splitByLocale, windowFor,
} from "./google-insights";

describe("readConfig", () => {
  const full: Record<string, string | undefined> = {
    GOOGLE_INSIGHTS_CLIENT_EMAIL: "bot@x.iam.gserviceaccount.com",
    GOOGLE_INSIGHTS_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    GA4_PROPERTY_ID: "12345",
    GSC_SITE_URL: "https://reviosoft.app/",
  };

  it("is null unless every variable is present — the screen must say 'not configured', not half-work", () => {
    for (const key of Object.keys(full)) {
      const partial = { ...full };
      delete partial[key];
      expect(readConfig(partial), `missing ${key}`).toBeNull();
    }
    expect(readConfig(full)).not.toBeNull();
  });

  it("turns the literal \\n of an env var back into real newlines, or signing fails obscurely", () => {
    expect(readConfig(full)!.privateKey).toContain("\n");
    expect(readConfig(full)!.privateKey).not.toContain("\\n");
  });
});

describe("windowFor", () => {
  const today = new Date("2026-09-22T09:00:00Z");

  it("ends YESTERDAY — a day in progress makes every period look like a decline", () => {
    expect(windowFor(7, today).current).toEqual({ startDate: "2026-09-15", endDate: "2026-09-21" });
  });

  it("compares against the immediately preceding window of the same length", () => {
    expect(windowFor(7, today).previous).toEqual({ startDate: "2026-09-08", endDate: "2026-09-14" });
  });

  it("does not overlap the two windows", () => {
    const w = windowFor(28, today);
    expect(w.previous.endDate < w.current.startDate).toBe(true);
  });
});

describe("delta", () => {
  it("is null rather than a flattering number when there is nothing to compare against", () => {
    expect(delta(40, 0)).toBeNull();
  });
  it("reports a fall as plainly as a rise", () => {
    expect(delta(50, 100)).toBe(-50);
    expect(delta(150, 100)).toBe(50);
  });
});

describe("shaping", () => {
  it("converts GA4's compact date", () => {
    expect(parseGaDate("20260921")).toBe("2026-09-21");
  });

  it("drops rows GA4 could not date, rather than rendering an invalid bar", () => {
    const rows = [
      { dimensionValues: [{ value: "20260921" }], metricValues: [{ value: "9" }, { value: "31" }] },
      { dimensionValues: [{ value: "(other)" }], metricValues: [{ value: "4" }, { value: "4" }] },
    ];
    expect(shapeTraffic(rows).map((d) => d.day)).toEqual(["2026-09-21"]);
  });

  it("sorts days ascending whatever order Google returned them in", () => {
    const rows = [
      { dimensionValues: [{ value: "20260921" }], metricValues: [{ value: "1" }, { value: "1" }] },
      { dimensionValues: [{ value: "20260919" }], metricValues: [{ value: "2" }, { value: "2" }] },
    ];
    expect(shapeTraffic(rows).map((d) => d.day)).toEqual(["2026-09-19", "2026-09-21"]);
  });

  it("turns Google's CTR fraction into a percentage a person reads", () => {
    expect(shapeQueries([{ keys: ["канален мениджър"], ctr: 0.0834, position: 12.37 }])[0]).toMatchObject({
      ctr: 8.3,
      position: 12.4,
    });
  });

  it("strips the site origin, because a column of identical prefixes is a column of noise", () => {
    const rows = [{ keys: ["https://reviosoft.app/bg/pricing"] }, { keys: ["https://reviosoft.app/"] }];
    expect(shapePages(rows, "https://reviosoft.app/").map((p) => p.page)).toEqual(["/bg/pricing", "/"]);
  });
});

describe("splitByLocale", () => {
  it("counts /bg and /bg/... as Bulgarian and nothing else", () => {
    expect(localeOf("/bg")).toBe("bg");
    expect(localeOf("/bg/pricing")).toBe("bg");
    /* ⚠️ The trap: a path that merely STARTS with the two letters is not the locale. */
    expect(localeOf("/bgsomething")).toBe("en");
    expect(localeOf("/pricing")).toBe("en");
  });

  it("totals each side separately, which is the whole point of translating the site", () => {
    const totals = splitByLocale([
      { page: "/bg/pricing", clicks: 4, impressions: 100 },
      { page: "/pricing", clicks: 6, impressions: 250 },
      { page: "/bg", clicks: 1, impressions: 40 },
    ]);
    expect(totals.bg).toEqual({ clicks: 5, impressions: 140 });
    expect(totals.en).toEqual({ clicks: 6, impressions: 250 });
  });
});
