"use client";

import { useRef } from "react";
import { setMaintenanceStatus } from "@/lib/actions-maintenance";

const TINT: Record<string, string> = {
  open: "text-ink-700 border-surface-border",
  in_progress: "text-warning-600 border-warning-500/60",
  done: "text-success-600 border-success-500/60",
};

/** Compact maintenance-status changer: a native select that submits setMaintenanceStatus on change. */
export function MaintStatusControl({ id, status }: { id: string; status: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setMaintenanceStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        key={status}
        name="status"
        defaultValue={status}
        onChange={() => ref.current?.requestSubmit()}
        aria-label="Task status"
        className={`cursor-pointer rounded-md border bg-white px-2 py-1 text-[12px] font-semibold outline-none focus:border-accent-600 ${TINT[status] ?? TINT.open}`}
      >
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
    </form>
  );
}
