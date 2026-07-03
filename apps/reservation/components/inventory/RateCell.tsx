"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCalendarRate } from "@/lib/actions-rates";

/** Inline-editable standard-plan rate in the Inventory Calendar — writes the SAME RatePrice rows
 *  the CM's grid edits (derived plans recalc from it automatically). */
export function RateCell({ roomTypeId, date, value }: { roomTypeId: string; date: string; value: string }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit(raw: string) {
    const clean = raw.replace(/[^0-9.]/g, "");
    start(async () => {
      if (clean !== "") await saveCalendarRate({ roomTypeId, date, value: clean });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        defaultValue={value === "—" ? "" : value.replace(/[^0-9.]/g, "")}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") setEditing(false);
        }}
        className="tnum w-full min-w-[44px] rounded border border-brand-600 bg-white px-1 py-0.5 text-center text-[12px] font-semibold text-ink-900 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      className={`tnum w-full rounded px-1 py-0.5 text-center text-[12px] font-semibold text-ink-700 transition-colors hover:bg-brand-50 ${pending ? "opacity-50" : ""}`}
      title="Click to edit the standard rate"
    >
      {value === "—" ? "—" : `€${value}`}
    </button>
  );
}
