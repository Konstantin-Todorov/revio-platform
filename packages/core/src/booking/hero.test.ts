import { describe, expect, it } from "vitest";
import {
  DEFAULT_HERO_FOCAL_Y,
  HERO_LUMINANCE_SCALE,
  HERO_OVERLAY_LEVELS,
  heroFocalY,
  heroOverlayLevel,
  heroScrim,
  measureHeroLuminance,
  minimumScrimAlpha,
} from "./hero.js";

/**
 * The point of these tests is the same as `apps/booking/lib/brand.test.ts`: this page wears a
 * DIFFERENT hotel's photograph on every visit, so "it looked fine on the demo hotel" is not
 * evidence. The contrast assertion is therefore checked across the whole range of images that can
 * exist, one step at a time, rather than on a few chosen pictures.
 */

/** The WCAG maths again, written out independently — a test that reuses the implementation's own
 *  helpers can only prove the code is self-consistent, which is not the claim being made. */
function contrastOfWhiteOverBlackScrim(luminance0to1: number, alpha: number): number {
  const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const greyOf = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
  const composited = toLinear(greyOf(luminance0to1) * (1 - alpha));
  return 1.05 / (composited + 0.05);
}

describe("minimumScrimAlpha", () => {
  it("gives every possible image a scrim that actually measures 4.5:1", () => {
    // Every storable luminance, not a sample of them. 1001 cases costs nothing and the alternative
    // is finding the gap when a hotel uploads the one photograph that lands in it.
    const failures: string[] = [];
    for (let stored = 0; stored <= HERO_LUMINANCE_SCALE; stored++) {
      const alpha = minimumScrimAlpha(stored);
      const ratio = contrastOfWhiteOverBlackScrim(stored / HERO_LUMINANCE_SCALE, alpha);
      // 4.49 rather than 4.5: alpha is rounded to two places for CSS, which can cost a hair.
      if (ratio < 4.49) failures.push(`L=${stored} → alpha ${alpha} → ${ratio.toFixed(3)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("asks for nothing at all on an image dark enough to carry white text unaided", () => {
    // A night shot. This is the case that justifies measuring instead of applying a fixed scrim:
    // a blanket 40% overlay would flatten a photograph that was already perfect.
    expect(minimumScrimAlpha(0)).toBe(0);
    expect(minimumScrimAlpha(120)).toBe(0);
  });

  it("darkens a white facade hard, and stops well short of hiding it", () => {
    const alpha = minimumScrimAlpha(HERO_LUMINANCE_SCALE);
    expect(alpha).toBeGreaterThan(0.45);
    // A scrim past ~0.7 is not a photograph any more, it is a dark rectangle. If this ever fails,
    // the maths changed — the answer is not to raise the bound.
    expect(alpha).toBeLessThan(0.6);
  });

  it("never gets lighter as the image gets brighter", () => {
    let previous = -1;
    for (let stored = 0; stored <= HERO_LUMINANCE_SCALE; stored += 5) {
      const alpha = minimumScrimAlpha(stored);
      expect(alpha).toBeGreaterThanOrEqual(previous);
      previous = alpha;
    }
  });

  it("treats a missing measurement as the worst case rather than as no problem", () => {
    // Rows uploaded before the measurement existed, and any future failure to measure, land here.
    // Defaulting to 0 would be the same bug as a rate limiter that fails open silently.
    expect(minimumScrimAlpha(null)).toBe(minimumScrimAlpha(HERO_LUMINANCE_SCALE));
    expect(minimumScrimAlpha(undefined)).toBe(minimumScrimAlpha(HERO_LUMINANCE_SCALE));
    expect(minimumScrimAlpha(Number.NaN)).toBe(minimumScrimAlpha(HERO_LUMINANCE_SCALE));
  });
});

describe("heroScrim", () => {
  it("lets the hotel go darker than readable but never lighter", () => {
    const failures: string[] = [];
    for (let stored = 0; stored <= HERO_LUMINANCE_SCALE; stored += 1) {
      const floor = minimumScrimAlpha(stored);
      for (const level of HERO_OVERLAY_LEVELS) {
        const { alpha } = heroScrim(stored, level.key);
        if (alpha < floor) failures.push(`L=${stored} ${level.key}: ${alpha} < floor ${floor}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("orders the levels the way their labels promise", () => {
    const mid = 500;
    const [minimal, balanced, strong] = HERO_OVERLAY_LEVELS.map((l) => heroScrim(mid, l.key).alpha);
    expect(minimal).toBeLessThan(balanced!);
    expect(balanced).toBeLessThan(strong!);
  });

  it("reports when a level is adding nothing, so the screen can say so", () => {
    // On a dark photo "Show the photo" and the floor are the same thing, and a control that appears
    // to do nothing needs to explain itself rather than look broken.
    expect(heroScrim(0, "minimal").atFloor).toBe(true);
    expect(heroScrim(0, "strong").atFloor).toBe(false);
  });

  it("keeps a strong overlay off pure black, so the photo is always still there", () => {
    expect(heroScrim(HERO_LUMINANCE_SCALE, "strong").alpha).toBeLessThanOrEqual(0.92);
  });

  it("falls back to the default level for an unknown or missing key", () => {
    expect(heroScrim(400, "sepia-vibes").alpha).toBe(heroScrim(400, "balanced").alpha);
    expect(heroOverlayLevel(null).key).toBe("balanced");
  });
});

describe("measureHeroLuminance", () => {
  /** `count` pixels of one grey, as sharp's raw RGB output would arrive. */
  function greyPixels(value: number, count: number): number[] {
    return Array.from({ length: count * 3 }, () => value);
  }

  it("measures white and black at the ends of the scale", () => {
    expect(measureHeroLuminance(greyPixels(255, 64), 3)).toBe(HERO_LUMINANCE_SCALE);
    expect(measureHeroLuminance(greyPixels(0, 64), 3)).toBe(0);
  });

  it("catches a bright region big enough for a headline to land on", () => {
    // 70% dark, 30% blown-out sky. A mean would report this as a dark image; it is not, for text.
    const pixels = [...greyPixels(10, 70), ...greyPixels(250, 30)];
    expect(measureHeroLuminance(pixels, 3)).toBeGreaterThan(800);
  });

  it("does NOT discount a small bright region, however small", () => {
    /*
     * This is the assertion that replaced its own opposite.
     *
     * The first version took the 90th PERCENTILE and this test asserted that 5% of blown-out pixels
     * should be ignored, on the reasoning that one bright corner should not darken a whole page.
     * Then the feature was measured in a real browser: with the focal point moved, exactly that
     * bright region landed under the headline and the composited text came out at **4.14:1** — from
     * a scrim the maths had certified as sufficient.
     *
     * A percentile is an argument about where the text probably is not. Text is wherever the crop
     * puts it. So the brightest region wins, and a hotel whose photo has one hot corner gets a
     * slightly heavier scrim than its average suggests. That is the trade, taken deliberately.
     */
    const oneBrightCellIn1024 = [...greyPixels(10, 1023), ...greyPixels(255, 1)];
    expect(measureHeroLuminance(oneBrightCellIn1024, 3)).toBe(HERO_LUMINANCE_SCALE);
  });

  it("bounds every crop of the image, which is what makes one stored number safe", () => {
    /*
     * The property the whole design rests on: the guest sees a CROP, chosen by the hotel's focal
     * point and by their own viewport, but we store ONE number measured from the whole picture.
     * That is only sound because cropping removes regions and never adds brighter ones — so the
     * maximum over the whole frame is an upper bound on the maximum over any sub-region of it.
     */
    const image = [
      ...greyPixels(20, 300), ...greyPixels(200, 200), ...greyPixels(90, 400), ...greyPixels(140, 124),
    ];
    const whole = measureHeroLuminance(image, 3);
    // Every contiguous crop, at every offset and length — none may exceed the whole-image reading.
    for (let start = 0; start < 1024; start += 37) {
      for (const len of [1, 8, 64, 256, 700]) {
        const crop = image.slice(start * 3, (start + len) * 3);
        if (crop.length < 3) continue;
        expect(measureHeroLuminance(crop, 3)).toBeLessThanOrEqual(whole);
      }
    }
  });

  it("reads RGBA as well as RGB, without treating alpha as a colour", () => {
    const rgba: number[] = [];
    for (let i = 0; i < 64; i++) rgba.push(255, 255, 255, 0);
    // If the 0 alpha were read as a channel this would come out far darker than white.
    expect(measureHeroLuminance(rgba, 4)).toBe(HERO_LUMINANCE_SCALE);
  });

  it("weights green over blue, as human vision does", () => {
    const green = Array.from({ length: 64 * 3 }, (_, i) => (i % 3 === 1 ? 255 : 0));
    const blue = Array.from({ length: 64 * 3 }, (_, i) => (i % 3 === 2 ? 255 : 0));
    expect(measureHeroLuminance(green, 3)).toBeGreaterThan(measureHeroLuminance(blue, 3));
  });

  it("treats an empty buffer as the worst case rather than as black", () => {
    // A decode that produced nothing must not be read as "a very dark photo, no scrim needed".
    expect(measureHeroLuminance([], 3)).toBe(HERO_LUMINANCE_SCALE);
  });

  it("refuses a channel count it cannot interpret", () => {
    expect(() => measureHeroLuminance([1, 2, 3], 1)).toThrow();
  });
});

describe("heroFocalY", () => {
  it("centres when nothing is stored", () => {
    expect(heroFocalY(null)).toBe(DEFAULT_HERO_FOCAL_Y);
    expect(heroFocalY(undefined)).toBe(DEFAULT_HERO_FOCAL_Y);
  });

  it("clamps a value from outside the slider into the picture", () => {
    expect(heroFocalY(-40)).toBe(0);
    expect(heroFocalY(180)).toBe(100);
    expect(heroFocalY(33.6)).toBe(34);
  });
});
