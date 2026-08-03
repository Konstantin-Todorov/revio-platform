/**
 * The real Revio mark, served from `public/mark.png`.
 *
 * A raster, not a hand-traced SVG. The shape is the founder's artwork (`design/brand/`) and a
 * brand mark is never re-drawn by eye — a stem a few units off is invisible in review and wrong
 * forever. At the sizes this renders (32–36px from a 128px source) there is nothing to gain from a
 * vector, and nothing to lose to a bad trace.
 *
 * The tile is white on purpose. The console is the platform, not a product, so where RevioLink,
 * RevioCRS and RevioPMS each carry their own colour, this one leaves that slot empty — which is
 * also the fastest way to tell, at a glance, that you are looking at the operator perimeter and not
 * at a hotel's own app.
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
