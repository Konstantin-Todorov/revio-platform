import "server-only";
import sharp from "sharp";

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
