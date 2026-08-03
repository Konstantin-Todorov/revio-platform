/**
 * The real RevioCRS mark, served from `public/mark.png`.
 *
 * A raster, not a hand-traced SVG. The shape is the founder's artwork (`design/brand/`) and a
 * brand mark is never re-drawn by eye — a stem a few units off is invisible in review and wrong
 * forever. At the sizes this renders (32–36px from a 128px source) there is nothing to gain from a
 * vector, and nothing to lose to a bad trace.
 *
 * The tile is indigo because that is this product's accent; `product.mark` in the Tailwind config is
 * the same value, which is why the rail beside the active nav item matches the logo without anyone
 * having to keep two numbers in step.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/mark.png"
      alt=""
      width={128}
      height={128}
      className={className}
      aria-hidden="true"
    />
  );
}
