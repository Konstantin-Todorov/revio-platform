"use client";

import { useState } from "react";
import { Play, Check, TriangleAlert, X } from "lucide-react";
import { startCleaning, finishCleaning, reportRoomIssue } from "@/lib/actions-units";
import type { HkStatus } from "@/lib/hk-meta";

/**
 * Housekeeper quick actions on a room tile (spec §3.4): Start cleaning (dirty → in-progress, subject
 * to the one-room-in-progress rule enforced server-side), Finish (in-progress → clean), and
 * Report-an-issue (→ a Maintenance task). The desktop status <select> above stays for supervisors.
 */
export function RoomActions({ unitId, status }: { unitId: string; status: HkStatus }) {
  const [reporting, setReporting] = useState(false);

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {status === "dirty" && (
          <form action={startCleaning} className="flex-1">
            <input type="hidden" name="unitId" value={unitId} />
            <button className="flex w-full items-center justify-center gap-1 rounded-md bg-brand-700 px-2 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-600">
              <Play className="h-3 w-3" /> Start
            </button>
          </form>
        )}
        {status === "in_progress" && (
          <form action={finishCleaning} className="flex-1">
            <input type="hidden" name="unitId" value={unitId} />
            <button className="flex w-full items-center justify-center gap-1 rounded-md bg-success-600 px-2 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-success-500">
              <Check className="h-3 w-3" /> Finish
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => setReporting((v) => !v)}
          title="Report an issue"
          className={`flex items-center justify-center rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors ${reporting ? "border-danger-500/60 bg-danger-50 text-danger-600" : "border-surface-border text-ink-500 hover:bg-surface-muted"} ${status === "dirty" || status === "in_progress" ? "" : "flex-1"}`}
        >
          {reporting ? <X className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
        </button>
      </div>
      {reporting && (
        <form action={reportRoomIssue} className="flex items-center gap-1" onSubmit={() => setReporting(false)}>
          <input type="hidden" name="unitId" value={unitId} />
          <input
            name="title"
            required
            autoFocus
            placeholder="Describe the fault…"
            className="min-w-0 flex-1 rounded-md border border-surface-border bg-white px-2 py-1 text-[11.5px] outline-none focus:border-danger-500"
          />
          <button className="shrink-0 rounded-md bg-danger-600 px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-danger-500">Log</button>
        </form>
      )}
    </div>
  );
}
