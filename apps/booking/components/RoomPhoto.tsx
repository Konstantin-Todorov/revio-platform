"use client";

import { useState } from "react";

/**
 * The room photograph, with a real failure state.
 *
 * A broken-image glyph on a hotel's own booking page looks like a broken hotel, and the row and the
 * object genuinely can drift apart — storage moved, a bucket swapped, an object expired. When the
 * bytes are not there the honest thing is to show nothing and let the tinted panel behind this
 * element be what it already is: the designed no-photo state.
 *
 * Its own client component so the card around it stays a server component — this is the only part
 * of a room card that needs to react to anything.
 */
export function RoomPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    /*
      Absolutely filling its column rather than carrying its own aspect ratio: the card's height is
      set by the rate rows beside it, and the photo's job is to occupy that whole side. `object-cover`
      centres the crop, which on a room photograph is the bed and the window.
    */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
