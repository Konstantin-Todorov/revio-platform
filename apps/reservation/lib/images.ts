import "server-only";
import sharp from "sharp";
import { measureHeroLuminance } from "@revio/core";

/**
 * Turning whatever a hotel uploaded into two images we are willing to serve.
 *
 * Hotels upload straight from a phone: 4000px, 6 MB, often rotated only by an EXIF tag. Serving
 * that to a guest on mobile data is most of what makes a booking page feel slow, so every upload is
 * re-encoded here rather than stored as-is. Re-encoding also means we never serve back the exact
 * bytes someone handed us, which removes a whole class of malicious-payload problems.
 *
 * Two variants because the gallery grid and the room card need genuinely different sizes; one
 * compromise size is either too heavy for the card or too soft for the gallery.
 */

/** Wide enough for a full-width card on a 2x laptop display without being a wallpaper. */
const FULL_WIDTH = 1600;
/** The card and the editor grid. */
const THUMB_WIDTH = 480;

/** Refuse anything that is not a still image we can actually decode. */
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"]);

/** 25 MB. Generous for a modern phone photo, small enough that a stray video is rejected. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface ProcessedImage {
  full: Uint8Array;
  thumb: Uint8Array;
  width: number;
  height: number;
}

export class ImageRejected extends Error {}

export async function processRoomPhoto(file: File): Promise<ProcessedImage> {
  if (!ACCEPTED.has(file.type)) {
    throw new ImageRejected("That file isn't an image we can use. JPEG, PNG, WebP or HEIC please.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageRejected(`That image is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 25 MB.`);
  }

  const input = Buffer.from(await file.arrayBuffer());

  // `failOn: "error"` rather than the default, so a truncated or malformed file is rejected here
  // with a message a hotel can act on instead of producing a half-decoded image.
  const pipeline = sharp(input, { failOn: "error" });
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw new ImageRejected("We couldn't read that image.");

  // A single tiny image is almost always a mistake (an icon, a screenshot thumbnail).
  if (meta.width < 400 || meta.height < 300) {
    throw new ImageRejected(`That image is only ${meta.width}×${meta.height}. Please use at least 400×300.`);
  }

  const render = (width: number) =>
    sharp(input, { failOn: "error" })
      // Honours the EXIF orientation tag and then strips it, so the image is upright everywhere —
      // browsers and email clients disagree about whether to apply it, and half of them ignore it.
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

  const [full, thumb] = await Promise.all([render(FULL_WIDTH), render(THUMB_WIDTH)]);

  return {
    full: new Uint8Array(full.data),
    thumb: new Uint8Array(thumb.data),
    // The dimensions of what we actually stored, not of what was uploaded — the public page uses
    // them to reserve space, and reserving the wrong shape is what makes a page jump as it loads.
    width: full.info.width,
    height: full.info.height,
  };
}

/* --- the hero background (BG1) ---------------------------------------------------------------- */

/**
 * Full-bleed and behind a headline, so it needs its own sizes.
 *
 * 2400px because the hero spans the whole viewport rather than a card: on a 2x laptop a 1400 CSS-px
 * band wants ~2800 device px, and 2400 is the point where the extra bytes stop buying visible
 * sharpness on a photograph that is deliberately darkened anyway. The room-photo 1600 would be
 * visibly soft here, which is why this is a second function and not a parameter — the two images
 * have different jobs and the numbers should be readable next to the reason for them.
 */
const HERO_WIDTH = 2400;
/** Big enough to judge the crop in the CRS editor, small enough to be free. */
const HERO_THUMB_WIDTH = 640;

/**
 * The grid the brightness is measured on.
 *
 * 32×32 = 1024 samples, each one the average of a whole region of the photograph. That averaging is
 * the point: it means the 90th percentile taken in `measureHeroLuminance` describes an area a
 * headline could actually land on, rather than a single blown-out pixel.
 */
const LUMINANCE_GRID = 32;

export interface ProcessedHero extends ProcessedImage {
  /** 0–1000. What the overlay is derived from — see packages/core/src/booking/hero.ts. */
  luminance: number;
}

export async function processHeroImage(file: File): Promise<ProcessedHero> {
  if (!ACCEPTED.has(file.type)) {
    throw new ImageRejected("That file isn't an image we can use. JPEG, PNG, WebP or HEIC please.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageRejected(`That image is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 25 MB.`);
  }

  const input = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(input, { failOn: "error" }).metadata();
  if (!meta.width || !meta.height) throw new ImageRejected("We couldn't read that image.");

  // Stricter than a room photo, and about shape rather than only size. A hero is cropped to a wide
  // band, so a portrait phone snap loses most of itself and a small one is stretched into mush —
  // both look like our bug rather than like the hotel's photo choice.
  if (meta.width < 1200) {
    throw new ImageRejected(
      `That image is ${meta.width}px wide. A background needs at least 1200px — it spans the whole page.`,
    );
  }
  if (meta.width < meta.height) {
    throw new ImageRejected(
      "That photo is taller than it is wide. A background is a wide band, so most of an upright photo gets cropped away — please use a landscape one.",
    );
  }

  const render = (width: number) =>
    sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

  /*
   * Measured from the SAME rotated pipeline the page will show, not from the original bytes.
   * A photo that is upright only because of an EXIF tag has its bright sky along a different edge
   * before `.rotate()` — measuring first would describe an image nobody ever sees.
   *
   * `.flatten()` composites any transparency onto white first: a PNG with an alpha channel would
   * otherwise measure as whatever is *under* nothing, and the browser paints transparent as the
   * page behind it, which here is light.
   */
  const measured = await sharp(input, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: LUMINANCE_GRID, height: LUMINANCE_GRID, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [full, thumb] = await Promise.all([render(HERO_WIDTH), render(HERO_THUMB_WIDTH)]);

  return {
    full: new Uint8Array(full.data),
    thumb: new Uint8Array(thumb.data),
    width: full.info.width,
    height: full.info.height,
    luminance: measureHeroLuminance(measured.data, measured.info.channels),
  };
}
