/**
 * The hero background image, and the scrim that keeps the words on it readable.
 *
 * A hotel uploads a photograph of its terrace and we put a headline on top of it. That is where
 * every hotel booking page loses its typography: the photo is chosen for how it looks, the text is
 * white because white is what people use, and on a bright shot of a pool at noon the headline
 * disappears. It is not a rare case — it is the *usual* photograph a hotel is proud of.
 *
 * So the darkening layer is **measured from the image**, exactly the way `apps/booking/lib/brand.ts`
 * measures the brand colour rather than clamping it. At upload we sample the picture down to a small
 * grid and record how bright its brightest regions actually are; here we walk the scrim up one
 * percent at a time until white text on the composited result reaches 4.5:1. A dark photograph gets
 * almost no scrim and stays a photograph; a snow-white facade gets whatever it needs.
 *
 * The hotel still chooses, but only **upwards**. They can ask for a moodier page than the minimum;
 * they cannot ask for one a guest cannot read. That asymmetry is the whole design: contrast is ours
 * to guarantee, atmosphere is theirs to choose.
 *
 * Pure and framework-free, because three surfaces have to agree on the number — the guest's page,
 * the CRS live preview, and the tests. A preview that approximates the real scrim teaches a hotel to
 * expect a page they will not get.
 */

/** WCAG AA for normal text. The sub-headline sits at 15.5px, so the large-text 3:1 does not apply. */
const TARGET_CONTRAST = 4.5;

/**
 * Luminance is stored as an integer 0–1000 rather than a float.
 *
 * Same reason money is stored in minor units: it crosses a database column and a form post, and a
 * float that round-trips through those loses its last digits in a way nobody notices until two
 * environments disagree about a scrim.
 */
export const HERO_LUMINANCE_SCALE = 1000;

/**
 * How much darker than *readable* the hotel wants it.
 *
 * `extra` is added to the measured minimum, never substituted for it — which is why "minimal" is
 * zero rather than a small number: minimal means "as little as is honest", and on a dark photograph
 * that genuinely is nothing at all.
 */
export interface HeroOverlayLevel {
  key: string;
  label: string;
  blurb: string;
  /** Added on top of the measured floor, then clamped. */
  extra: number;
}

export const HERO_OVERLAY_LEVELS: readonly HeroOverlayLevel[] = [
  {
    key: "minimal",
    label: "Show the photo",
    blurb: "Only as much shading as the words need. Your picture stays the loudest thing on the page.",
    extra: 0,
  },
  {
    key: "balanced",
    label: "Balanced",
    blurb: "A little more than the minimum. The safe choice if you may swap the photo later.",
    extra: 0.12,
  },
  {
    key: "strong",
    label: "Words first",
    blurb: "The photo becomes atmosphere behind the text. Best for busy or high-contrast pictures.",
    extra: 0.26,
  },
] as const;

export const DEFAULT_HERO_OVERLAY = "balanced";

export function heroOverlayLevel(key: string | null | undefined): HeroOverlayLevel {
  return (
    HERO_OVERLAY_LEVELS.find((l) => l.key === key) ??
    HERO_OVERLAY_LEVELS.find((l) => l.key === DEFAULT_HERO_OVERLAY)!
  );
}

export interface HeroScrim {
  /** The alpha to render the black overlay at, 0–1, rounded to two places. */
  alpha: number;
  /** The measured minimum — what readability alone demands. The UI shows this so the choice is informed. */
  floor: number;
  /** True when the hotel's chosen level is doing nothing beyond the floor. */
  atFloor: boolean;
}

/**
 * The scrim for one image at one chosen level.
 *
 * A null luminance means we have no measurement — an image uploaded before this was recorded, or a
 * measurement that failed. It falls back to the **worst case** (a fully white image), because the
 * alternative is a page that might be unreadable and we would not know. A slightly too-dark hero is
 * a cosmetic loss; an illegible one loses the booking.
 */
export function heroScrim(luminance: number | null | undefined, levelKey: string | null | undefined): HeroScrim {
  const level = heroOverlayLevel(levelKey);
  const floor = minimumScrimAlpha(luminance);
  const alpha = round2(Math.min(0.92, floor + level.extra));
  return { alpha, floor, atFloor: alpha <= floor + 0.005 };
}

/**
 * The least darkening that makes white text legible on an image this bright.
 *
 * Walked rather than solved. The closed form exists, but the walk is the thing a reader can check
 * against the WCAG formula line by line, and it is evaluated once per page render on a value that
 * changes when a hotel uploads a photo — there is nothing here worth trading legibility for.
 *
 * Terminates by construction: at alpha 1 the composite is black, which measures 21:1.
 */
export function minimumScrimAlpha(luminance: number | null | undefined): number {
  const l = normalizeLuminance(luminance);
  const grey = greyForLuminance(l);

  for (let step = 0; step <= 100; step++) {
    const alpha = step / 100;
    // A black overlay at `alpha` scales every sRGB channel by (1 - alpha). Applying that to the grey
    // of equal luminance is exact for a grey and a close approximation for a colour, because the
    // sRGB transfer is very nearly a pure power law — scaling all three channels scales the linear
    // luminance by the same factor whatever the hue.
    const composited = luminanceOfGrey(grey * (1 - alpha));
    if (contrastWithWhite(composited) >= TARGET_CONTRAST) return round2(alpha);
  }
  return 1;
}

/**
 * How bright is this picture, at its brightest?
 *
 * Takes the RAW bytes of an already-downscaled image — 32×32 is what the caller feeds it — and
 * returns the integer luminance to store. The downscale is load-bearing rather than an optimisation:
 * each of those 1024 samples is the *average* of a whole region of the photograph, so one glint off
 * a wine glass is already averaged into its surroundings. What survives the downscale is a region
 * roughly 3% of the frame across — comfortably large enough for a word to sit on.
 *
 * **The maximum of those regions, not the mean and not a percentile.** An earlier version took the
 * 90th percentile, on the reasoning that one blown-out corner should not darken a whole page. That
 * reasoning is wrong here, and browser-measured: with the focal point moved, a hotel's bright sky
 * landed directly under the headline and the composited text measured **4.14:1** — from a scrim that
 * the maths had "guaranteed" was enough. A percentile is an argument about where text *probably*
 * is not. Text is wherever the hotel's crop puts it.
 *
 * The maximum also buys the one property that makes a single stored number safe at all:
 *
 * > **Cropping can only remove regions, never add brighter ones.** So the brightest region of the
 * > whole photograph bounds the brightest region of *every* crop of it — at any focal point, any
 * > viewport, any aspect ratio.
 *
 * Without that, the stored value would describe the picture while the guest sees a crop, and the two
 * could disagree by exactly the amount that matters. The cost is a slightly heavier scrim on a photo
 * with a bright corner the text happens to miss — a taste compromise, against an unreadable page.
 */
export function measureHeroLuminance(pixels: ArrayLike<number>, channels: number): number {
  if (channels < 3) throw new Error("measureHeroLuminance needs at least 3 channels per pixel");

  let brightest = -1;
  for (let i = 0; i + channels - 1 < pixels.length; i += channels) {
    const l = relativeLuminance(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
    if (l > brightest) brightest = l;
  }
  // Nothing to measure is not the same as a dark photo. Fail to the worst case.
  if (brightest < 0) return HERO_LUMINANCE_SCALE;

  // Rounded UP, so the stored integer never understates the brightness it stands for.
  return Math.ceil(brightest * HERO_LUMINANCE_SCALE);
}

/* --- the colour maths, all of it standard WCAG/sRGB ------------------------------------------ */

/** Relative luminance of an 8-bit sRGB triple, per WCAG 2.x. */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function toLinear(channel8: number): number {
  const v = clamp(channel8, 0, 255) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminanceOfGrey(channel8: number): number {
  return toLinear(channel8);
}

/** The 8-bit grey whose relative luminance is `l` — the inverse of the transfer above. */
function greyForLuminance(l: number): number {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return clamp(v, 0, 1) * 255;
}

/** Contrast ratio against pure white text (relative luminance 1). */
function contrastWithWhite(background: number): number {
  return (1 + 0.05) / (background + 0.05);
}

/** Stored 0–1000 → 0–1, with anything missing or nonsensical treated as the worst case. */
function normalizeLuminance(stored: number | null | undefined): number {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return 1;
  return clamp(stored, 0, HERO_LUMINANCE_SCALE) / HERO_LUMINANCE_SCALE;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* --- the focal point ------------------------------------------------------------------------- */

/**
 * Which part of the picture survives the crop.
 *
 * A hero is a wide band and a hotel's photograph is whatever shape their camera produced, so
 * something is always cut. The default centre crop is wrong for the two most common hotel shots: a
 * building (the roof goes) and a sea view (the horizon slides off). One number fixes both, and it is
 * vertical because that is the axis a full-bleed band actually crops on every screen wider than it
 * is tall.
 */
export const DEFAULT_HERO_FOCAL_Y = 50;

export function heroFocalY(stored: number | null | undefined): number {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return DEFAULT_HERO_FOCAL_Y;
  return Math.round(clamp(stored, 0, 100));
}
