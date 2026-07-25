import { HeaderSkeleton, CardsSkeleton, TableSkeleton } from "@revio/ui/skeleton";

/** Analytics recomputes metrics over a date range plus its comparison period — slow by nature. */
export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <CardsSkeleton count={5} />
      <div className="mt-4 space-y-4">
        <TableSkeleton rows={4} />
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
