import { describe, expect, it } from "vitest";
import { BOOKING_PRESETS, BOOKING_FONTS, BOOKING_COPY_DEFAULTS, bookingPreset } from "./presets.js";

/**
 * Two surfaces render these: the public page and the CRS preview. If a preset is malformed, one of
 * them silently degrades — a preview that lies about what the guest will see is worse than none.
 */

const HSL = /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;

describe("booking presets", () => {
  it("keeps Clean first — it is the default a new property gets", () => {
    expect(BOOKING_PRESETS[0]!.key).toBe("clean");
    expect(bookingPreset(undefined).key).toBe("clean");
  });

  it("falls back rather than rendering an unstyled page for an unknown key", () => {
    for (const bad of [null, undefined, "", "midnight", "CLEAN"]) {
      expect(bookingPreset(bad).key).toBe("clean");
    }
  });

  it.each(BOOKING_PRESETS.map((p) => [p.key, p] as const))(
    "%s emits colour tokens in the space-separated HSL form CSS expects",
    (_key, preset) => {
      const { radius, hero, ...colours } = preset.tokens;
      for (const [name, value] of Object.entries(colours)) {
        expect(value, name).toMatch(HSL);
      }
    },
  );

  it.each(BOOKING_PRESETS.map((p) => [p.key, p] as const))("%s has a usable radius and hero", (_key, preset) => {
    expect(preset.tokens.radius).toBeGreaterThanOrEqual(6);
    expect(preset.tokens.radius).toBeLessThanOrEqual(28);
    expect(["wash", "solid", "plain"]).toContain(preset.tokens.hero);
  });

  it.each(BOOKING_PRESETS.map((p) => [p.key, p] as const))(
    "%s keeps its surface distinguishable from its ground",
    (_key, preset) => {
      // A card has to read as raised. Identical values would flatten the whole page.
      expect(preset.tokens.surface).not.toBe(preset.tokens.ground);
    },
  );

  it("never hardcodes an accent — the hotel's colour is the only saturated thing on the page", () => {
    for (const p of BOOKING_PRESETS) {
      const serialised = JSON.stringify(p.tokens);
      expect(serialised).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("has unique keys and labels", () => {
    expect(new Set(BOOKING_PRESETS.map((p) => p.key)).size).toBe(BOOKING_PRESETS.length);
    expect(new Set(BOOKING_PRESETS.map((p) => p.label)).size).toBe(BOOKING_PRESETS.length);
  });

  it("offers exactly the two typefaces the engine can render", () => {
    // No "mixed": a booking page has almost no running prose for a body serif to differentiate.
    expect(BOOKING_FONTS.map((f) => f.key)).toEqual(["sans", "serif"]);
  });

  it("ships default copy so a hotel that writes nothing still has a headline", () => {
    expect(BOOKING_COPY_DEFAULTS.headline.length).toBeGreaterThan(0);
    expect(BOOKING_COPY_DEFAULTS.subheadline.length).toBeGreaterThan(40);
  });
});
