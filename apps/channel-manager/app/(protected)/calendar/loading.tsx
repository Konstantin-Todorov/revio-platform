import { HeaderSkeleton, GridSkeleton } from "@revio/ui/skeleton";

/** The calendar builds a room-type × date grid from the availability waterfall — the heaviest
 *  query in RevioLink, so it gets a grid-shaped fallback rather than the generic one. */
export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <GridSkeleton rows={10} />
    </div>
  );
}
