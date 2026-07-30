import { HeaderSkeleton, GridSkeleton } from "@revio/ui/skeleton";

/** Same shape as the RevioLink calendar — the availability waterfall across every room type. */
export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <GridSkeleton rows={10} />
    </div>
  );
}
