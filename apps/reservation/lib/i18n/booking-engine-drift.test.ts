import { describe, expect, it } from "vitest";
import { BOOKING_FONTS, BOOKING_PRESETS, HERO_OVERLAY_LEVELS } from "@revio/core";
import { SLUG_MAX_LEN, slugRejectionReason } from "@revio/booking";
import { bookingEngine } from "./booking-engine";

/**
 * Words core and @revio/booking write in English, worded here by key so the Booking Engine screen can
 * be Bulgarian. The English must stay what the source says, and every key the source has must exist.
 */
describe("Booking Engine English matches its sources", () => {
  const en = bookingEngine.en;
  it("every preset", () => {
    for (const p of BOOKING_PRESETS) expect(en.presets[p.key]).toEqual({ label: p.label, blurb: p.blurb });
  });
  it("every font", () => {
    for (const f of BOOKING_FONTS) expect(en.fonts[f.key]).toBe(f.label);
  });
  it("every shading level", () => {
    for (const l of HERO_OVERLAY_LEVELS) expect(en.overlays[l.key]).toEqual({ label: l.label, blurb: l.blurb });
  });
  it("every address refusal", () => {
    expect(en.errors.slug.short).toBe(slugRejectionReason("ab"));
    expect(en.errors.slug.long(SLUG_MAX_LEN)).toBe(slugRejectionReason("a".repeat(SLUG_MAX_LEN + 1)));
    expect(en.errors.slug.chars).toBe(slugRejectionReason("Hotel--Sofia"));
    expect(en.errors.slug.reserved).toBe(slugRejectionReason("admin"));
  });
});
