import { describe, expect, it } from "vitest";
import { normaliseRoute, isRecordableRoute } from "./routes";

describe("normaliseRoute — a screen's name, not a record's address", () => {
  it("leaves a plain screen alone", () => {
    expect(normaliseRoute("/reservations")).toBe("/reservations");
    expect(normaliseRoute("/rooms-rates")).toBe("/rooms-rates");
    expect(normaliseRoute("/settings/property")).toBe("/settings/property");
  });

  it("collapses the id that would otherwise make one row per reservation", () => {
    expect(normaliseRoute("/reservations/cmtrurie80005xljohf2lbnmo")).toBe("/reservations/:id");
    expect(normaliseRoute("/clients/cmtrmqxq40001dyc88habd40q/notes")).toBe("/clients/:id/notes");
  });

  it("collapses every id shape this platform actually issues", () => {
    expect(normaliseRoute("/invoice/12345")).toBe("/invoice/:id");
    expect(normaliseRoute("/support/SR-2LBNMO")).toBe("/support/:id");
    expect(normaliseRoute("/booking/RV-07NR0F")).toBe("/booking/:id");
    expect(normaliseRoute("/x/3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("/x/:id");
  });

  it("collapses a date, so a calendar is one screen and not three hundred", () => {
    expect(normaliseRoute("/calendar/2026-08-14")).toBe("/calendar/:date");
  });

  it("drops everything after ? — a query can carry a guest's own words", () => {
    expect(normaliseRoute("/guests?q=maria@example.com")).toBe("/guests");
    expect(normaliseRoute("/search?q=Ivanov&from=2026-01-01")).toBe("/search");
    expect(normaliseRoute("/reservations#note")).toBe("/reservations");
  });

  it("never stores a guest's name from a slug-shaped segment", () => {
    // Long opaque segments collapse; short chosen words do not.
    expect(normaliseRoute(`/x/${"a".repeat(40)}`)).toBe("/x/:id");
    expect(normaliseRoute("/x/housekeeping")).toBe("/x/housekeeping");
  });

  it("handles the root and stray slashes", () => {
    expect(normaliseRoute("/")).toBe("/");
    expect(normaliseRoute("")).toBe("/");
    expect(normaliseRoute("//reservations//")).toBe("/reservations");
  });
});

describe("isRecordableRoute — the cheapest write is the one that does not happen", () => {
  it("records real screens", () => {
    expect(isRecordableRoute("/dashboard")).toBe(true);
    expect(isRecordableRoute("/settings/account")).toBe(true);
  });

  it("ignores the ones that say nothing about what a hotel uses", () => {
    for (const r of ["/login", "/login/2fa", "/logout", "/api/jobs/holds", "/favicon.ico"]) {
      expect(isRecordableRoute(r)).toBe(false);
    }
  });

  it("refuses anything that is not a path", () => {
    expect(isRecordableRoute("https://example.com/x")).toBe(false);
  });
});
