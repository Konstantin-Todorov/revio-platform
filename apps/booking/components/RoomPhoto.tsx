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
export function RoomPhoto({
  src, alt, width, height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    /* Not next/image: these are already our own resized WebP, so a second optimisation pass would
       burn CPU to produce the same bytes. Width/height reserve the box so the card does not jump. */
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className="aspect-[4/3] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
