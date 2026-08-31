"use client";

import { useState } from "react";
import { Users } from "lucide-react";

/**
 * Every occupancy's price for one night, on demand — OBP §6.5.
 *
 * ## Why this is a popover and not extra rows
 *
 * The spec is unusually direct about it: *"Do not explode the grid to N permanent rate rows per plan
 * per room type by default — that destroys the at-a-glance scan."* A four-guest room with three rate
 * plans would turn twelve rows into forty-eight, and the calendar's whole job is that a hotelier can
 * read a month in one look.
 *
 * So the cell keeps showing one number — the primary — with a small badge saying there are more, and
 * the rest are one click away.
 *
 * ## Why the badge exists at all
 *
 * Without it the cell is indistinguishable from a per-room price, and a hotelier looking at €120
 * would have no way to know a one-guest booking pays €95. That is the same class of error as the
 * whole feature: a number that is true and not the whole truth.
 */
export function OccupancyRatePopover({
  rates,
  primaryOccupancy,
  currency = "€",
}: {
  rates: { occupancy: number; minor: number | null }[];
  primaryOccupancy: number;
  currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const priced = rates.filter((r) => r.minor != null);
  // One priced occupancy is not a range — showing a badge would promise variety that is not there.
  if (priced.length < 2) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-expanded={open}
        aria-label={`Prices for ${priced.length} guest counts`}
        className="ml-0.5 inline-flex items-center gap-0.5 rounded px-0.5 text-[9.5px] font-bold text-brand-600 transition-colors hover:bg-brand-50"
      >
        <Users className="h-2.5 w-2.5" />
        {priced.length}
      </button>

      {open && (
        <span className="absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-surface-border bg-white px-2.5 py-2 shadow-lg">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">
            Per guest count
          </span>
          {priced.map((r) => (
            <span key={r.occupancy} className="flex items-baseline justify-between gap-3 text-[11.5px] leading-relaxed">
              <span className={r.occupancy === primaryOccupancy ? "font-semibold text-ink-900" : "text-ink-600"}>
                {r.occupancy}p{r.occupancy === primaryOccupancy ? " ·" : ""}
              </span>
              <span className={`tnum ${r.occupancy === primaryOccupancy ? "font-semibold text-ink-900" : "text-ink-700"}`}>
                {currency}
                {Math.round(r.minor! / 100)}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
