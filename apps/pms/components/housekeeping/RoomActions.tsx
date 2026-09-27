"use client";

import { useState } from "react";
import { Play, Check, TriangleAlert, X } from "lucide-react";
import { startCleaning, finishCleaning, reportRoomIssue } from "@/lib/actions-units";
import type { HkStatus } from "@/lib/hk-meta";

import { SubmitButton } from "@revio/ui/submit-button";
/**
 * Housekeeper quick actions on a room tile (spec §3.4): Start cleaning (dirty → in-progress, subject
 * to the one-room-in-progress rule enforced server-side), Finish (in-progress → clean), and
 * Report-an-issue (→ a Maintenance task). The desktop status <select> above stays for supervisors.
 */
export type RoomActionStrings = { start: string; starting: string; finish: string; report: string; describe: string; log: string };
const EN: RoomActionStrings = { start: "Start", starting: "Starting…", finish: "Finish", report: "Report an issue", describe: "Describe the fault…", log: "Log" };

export function RoomActions({ unitId, status, t = EN }: { unitId: string; status: HkStatus; t?: RoomActionStrings }) {
  const [reporting, setReporting] = useState(false);
  // Start or Finish takes the row; the report button then shrinks to its icon beside it.
  const busy = status === "dirty" || status === "in_progress";

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {status === "dirty" && (
          <form action={startCleaning} className="flex-1">
            <input type="hidden" name="unitId" value={unitId} />
            <SubmitButton className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-brand-700 px-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600" pendingLabel={t.starting}>
              <Play className="h-3.5 w-3.5" /> {t.start}
            </SubmitButton>
          </form>
        )}
        {status === "in_progress" && (
          <form action={finishCleaning} className="flex-1">
            <input type="hidden" name="unitId" value={unitId} />
            <button className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-success-600 px-2 text-[13px] font-semibold text-white transition-colors hover:bg-success-500">
              <Check className="h-3.5 w-3.5" /> {t.finish}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => setReporting((v) => !v)}
          title={t.report}
          aria-label={t.report}
          className={`flex h-10 items-center justify-center gap-1.5 rounded-md border bg-white/70 text-[12px] font-semibold transition-colors ${reporting ? "border-danger-500/60 bg-danger-50 text-danger-600" : "border-surface-border text-ink-600 hover:bg-surface-muted"} ${busy ? "w-10 shrink-0" : "flex-1 px-2"}`}
        >
          {reporting ? <X className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
          {/* Named whenever there is room: an unlabelled warning triangle reads as "something is wrong
              with this room", not as a button that reports one. */}
          {!busy && <span className="truncate">{t.report}</span>}
        </button>
      </div>
      {reporting && (
        <form action={reportRoomIssue} className="flex items-center gap-1" onSubmit={() => setReporting(false)}>
          <input type="hidden" name="unitId" value={unitId} />
          <input
            name="title"
            required
            autoFocus
            placeholder={t.describe}
            className="h-10 min-w-0 flex-1 rounded-md border border-surface-border bg-white px-2 text-[16px] outline-none focus:border-danger-500 sm:text-[13px]"
          />
          <button className="h-10 shrink-0 rounded-md bg-danger-600 px-3 text-[13px] font-semibold text-white hover:bg-danger-500">{t.log}</button>
        </form>
      )}
    </div>
  );
}
