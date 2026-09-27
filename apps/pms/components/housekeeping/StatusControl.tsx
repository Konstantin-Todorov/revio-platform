"use client";

import { useRef } from "react";
import { setUnitStatus } from "@/lib/actions-units";
import { HK_STATUSES, HK_LABEL, type HkStatus } from "@/lib/hk-meta";

const SELECT_TINT: Record<HkStatus, string> = {
  clean: "text-success-600 border-success-500/50",
  dirty: "text-warning-600 border-warning-500/60",
  in_progress: "text-brand-600 border-brand-500/50",
  inspected: "text-accent-600 border-accent-500/50",
  out_of_order: "text-danger-600 border-danger-500/60",
};

/**
 * Compact housekeeping-status changer: a native select that submits the setUnitStatus server action
 * on change (the OOO option triggers the waterfall write server-side). Works on touch/mobile (PWA).
 */
export function StatusControl({
  unitId, status, labels = HK_LABEL, aria = "Housekeeping status", options = HK_STATUSES, readOnly = false,
}: {
  unitId: string;
  status: HkStatus;
  labels?: Record<HkStatus, string>;
  aria?: string;
  /** The statuses this person may set — the server refuses the rest (`settableStatuses`). */
  options?: readonly HkStatus[];
  /** A status this person may not leave is said, not offered. */
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  if (readOnly) {
    return (
      <div className={`flex h-10 w-full items-center rounded-md border bg-white/70 px-2.5 text-[13px] font-semibold ${SELECT_TINT[status]}`}>
        {labels[status]}
      </div>
    );
  }
  return (
    <form ref={ref} action={setUnitStatus}>
      <input type="hidden" name="unitId" value={unitId} />
      <select
        // key on status forces a remount when the server truth changes, so the shown option always
        // matches the actual status after a revalidation (an uncontrolled select otherwise keeps its
        // original DOM value across a soft refresh).
        key={status}
        name="status"
        defaultValue={status}
        onChange={() => ref.current?.requestSubmit()}
        aria-label={aria}
        className={`h-10 w-full cursor-pointer rounded-md border bg-white px-2 text-[13px] font-semibold outline-none focus:border-accent-600 ${SELECT_TINT[status]}`}
      >
        {options.map((s) => (
          <option key={s} value={s}>{labels[s]}</option>
        ))}
      </select>
    </form>
  );
}
