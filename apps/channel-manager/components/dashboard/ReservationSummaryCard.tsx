"use client";

import { useState } from "react";
import { CalendarPlus, CalendarX } from "lucide-react";

type Pair = { today: number; yesterday: number };

/**
 * Reservation Summary card (spec §1.1): new + cancelled reservations for the selected day, counted by
 * ACTION date (made / cancelled). A Today / Yesterday toggle switches the whole card at once.
 */
export function ReservationSummaryCard({ newRes, cancelled }: { newRes: Pair; cancelled: Pair }) {
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const nNew = newRes[day];
  const nCancelled = cancelled[day];

  return (
    <div className="rounded-lg border border-surface-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h3 className="text-[14px] font-bold tracking-tight text-ink-900">Reservation Summary</h3>
        <div className="flex items-center gap-0.5 rounded-md border border-surface-border bg-white p-0.5">
          {(["today", "yesterday"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`rounded px-2.5 py-1 text-[11.5px] font-semibold capitalize transition-colors ${day === d ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-surface-border">
        <div className="p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-success-50 text-success-600"><CalendarPlus className="h-[18px] w-[18px]" /></div>
          <div className="tnum text-[26px] font-bold leading-none tracking-tight text-ink-900">{nNew}</div>
          <div className="mt-1.5 text-[12.5px] font-semibold text-ink-700">New reservations</div>
          <div className="text-[11px] text-ink-400">Made {day}</div>
        </div>
        <div className="p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-danger-50 text-danger-600"><CalendarX className="h-[18px] w-[18px]" /></div>
          <div className="tnum text-[26px] font-bold leading-none tracking-tight text-ink-900">{nCancelled}</div>
          <div className="mt-1.5 text-[12.5px] font-semibold text-ink-700">Cancelled</div>
          <div className="text-[11px] text-ink-400">Cancelled {day}</div>
        </div>
      </div>
    </div>
  );
}
