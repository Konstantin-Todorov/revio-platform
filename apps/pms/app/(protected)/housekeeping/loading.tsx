import { HeaderSkeleton, TableSkeleton } from "@revio/ui/skeleton";

/** The housekeeping board is the screen most often opened on a phone mid-shift — feedback matters. */
export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <TableSkeleton rows={10} />
    </div>
  );
}
