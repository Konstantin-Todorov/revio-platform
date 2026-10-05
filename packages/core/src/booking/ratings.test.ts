import { describe, expect, it } from "vitest";
import { formatRating, parseRatingTenths, ratingShown, ratingUrlAllowed } from "./ratings";

describe("public ratings", () => {
  it("reads a score on each source's own scale", () => {
    expect(parseRatingTenths("booking", "9,1")).toBe(91);
    expect(parseRatingTenths("booking", "10")).toBe(100);
    expect(parseRatingTenths("google", "4.7")).toBe(47);
    expect(parseRatingTenths("google", "9.1")).toBeNull();
    expect(parseRatingTenths("booking", "9.15")).toBeNull();
    expect(parseRatingTenths("booking", "")).toBeNull();
  });
  it("formats in the guest's language", () => {
    expect(formatRating(91, "bg")).toBe("9,1");
    expect(formatRating(90, "en")).toBe("9.0");
  });
  it("links only to the source's own site", () => {
    expect(ratingUrlAllowed("booking", "https://www.booking.com/hotel/bg/sofia.html")).toBe(true);
    expect(ratingUrlAllowed("booking", "https://booking.com.evil.io/x")).toBe(false);
    expect(ratingUrlAllowed("booking", "http://www.booking.com/x")).toBe(false);
    expect(ratingUrlAllowed("google", "https://maps.app.goo.gl/abc")).toBe(true);
    expect(ratingUrlAllowed("google", "https://www.google.com/maps/place/x")).toBe(true);
    expect(ratingUrlAllowed("google", "https://notgoogle.com/x")).toBe(false);
  });
  it("hides a low or stale score", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    expect(ratingShown({ source: "booking", scoreTenths: 88, confirmedAt: new Date("2026-09-01") }, now)).toBe(true);
    expect(ratingShown({ source: "booking", scoreTenths: 65, confirmedAt: new Date("2026-09-01") }, now)).toBe(false);
    expect(ratingShown({ source: "google", scoreTenths: 46, confirmedAt: new Date("2025-08-01") }, now)).toBe(false);
  });
});
