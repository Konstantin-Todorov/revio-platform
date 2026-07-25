/**
 * Loading skeletons — shared by every app's route-level `loading.tsx`.
 *
 * These screens query Postgres on every request (`force-dynamic`), so a slow calendar or analytics
 * page used to show the previous screen frozen with no feedback. A skeleton in the shape of what's
 * coming tells the user the click registered and roughly what will appear.
 */

export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-sunken ${className}`} />;
}

/** Page title + subtitle placeholder. */
export function HeaderSkeleton() {
  return (
    <div className="mb-5">
      <Shimmer className="h-6 w-52" />
      <Shimmer className="mt-2.5 h-3.5 w-72" />
    </div>
  );
}

/** A row of KPI cards — the shape of every product's dashboard. */
export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
          <Shimmer className="h-9 w-9 rounded-md" />
          <Shimmer className="mt-3 h-6 w-16" />
          <Shimmer className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** A table with a header band and n body rows. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <div className="border-b border-surface-border px-4 py-3">
        <Shimmer className="h-3.5 w-40" />
      </div>
      <div className="divide-y divide-surface-border/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Shimmer className="h-4 flex-1" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The calendar / board grid — wide, dense, and the slowest thing we render. */
export function GridSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <div className="flex gap-2 border-b border-surface-border px-4 py-3">
        <Shimmer className="h-4 w-40" />
        {Array.from({ length: 10 }).map((_, i) => <Shimmer key={i} className="h-4 flex-1" />)}
      </div>
      <div className="divide-y divide-surface-border/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-2 px-4 py-2.5">
            <Shimmer className="h-4 w-40" />
            {Array.from({ length: 10 }).map((_, i) => <Shimmer key={i} className="h-4 flex-1" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Default page-level fallback: header + cards + a table. */
export function PageSkeleton() {
  return (
    <div>
      <HeaderSkeleton />
      <CardsSkeleton />
      <div className="mt-4">
        <TableSkeleton />
      </div>
    </div>
  );
}
